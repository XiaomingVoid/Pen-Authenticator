// AES-256-CBC + PKCS#7（纯 JS，用于本地保险库加密）
// S 盒用 GF(2^8) 逆元 + 仿射变换在运行时生成，避免手抄 256 项常量出错。

function gmul(a, b) {
    let p = 0
    let x = a & 0xff
    let y = b & 0xff
    for (let i = 0; i < 8; i++) {
        if (y & 1) p ^= x
        const hi = x & 0x80
        x = (x << 1) & 0xff
        if (hi) x ^= 0x1b
        y >>= 1
    }
    return p & 0xff
}

const rotl8 = (v, n) => ((v << n) | (v >>> (8 - n))) & 0xff

function buildTables() {
    const inv = new Uint8Array(256)
    for (let i = 1; i < 256; i++) {
        for (let j = 1; j < 256; j++) {
            if (gmul(i, j) === 1) {
                inv[i] = j
                break
            }
        }
    }
    const sbox = new Uint8Array(256)
    const invSbox = new Uint8Array(256)
    for (let x = 0; x < 256; x++) {
        const b = inv[x]
        const s = b ^ rotl8(b, 1) ^ rotl8(b, 2) ^ rotl8(b, 3) ^ rotl8(b, 4) ^ 0x63
        sbox[x] = s
        invSbox[s] = x
    }
    // 乘法表：MixColumns 里逐字节 gmul 太慢（真机 2ms/块），预先算好查表
    const mul = {}
    for (const factor of [2, 3, 9, 11, 13, 14]) {
        const table = new Uint8Array(256)
        for (let i = 0; i < 256; i++) table[i] = gmul(i, factor)
        mul[factor] = table
    }
    return { sbox, invSbox, mul }
}

const TABLES = buildTables()

/** AES-256 密钥扩展：返回 60 个 32 位轮密钥 */
function expandKey(key) {
    if (key.length !== 32) throw new Error('AES-256 需要 32 字节密钥')
    const Nk = 8
    const Nr = 14
    const w = new Uint32Array(4 * (Nr + 1))
    for (let i = 0; i < Nk; i++) {
        w[i] = (key[i * 4] << 24) | (key[i * 4 + 1] << 16) | (key[i * 4 + 2] << 8) | key[i * 4 + 3]
    }
    let rcon = 1
    for (let i = Nk; i < w.length; i++) {
        let temp = w[i - 1]
        if (i % Nk === 0) {
            temp = ((temp << 8) | (temp >>> 24)) >>> 0
            temp = (subWord(temp) ^ (rcon << 24)) >>> 0
            rcon = gmul(rcon, 2)
        } else if (i % Nk === 4) {
            temp = subWord(temp)
        }
        w[i] = (w[i - Nk] ^ temp) >>> 0
    }
    return { roundKeys: w, rounds: Nr }
}

function subWord(word) {
    const { sbox } = TABLES
    return ((sbox[(word >>> 24) & 0xff] << 24) |
        (sbox[(word >>> 16) & 0xff] << 16) |
        (sbox[(word >>> 8) & 0xff] << 8) |
        sbox[word & 0xff]) >>> 0
}

function addRoundKey(state, roundKeys, round) {
    for (let c = 0; c < 4; c++) {
        const k = roundKeys[round * 4 + c]
        state[c * 4] ^= (k >>> 24) & 0xff
        state[c * 4 + 1] ^= (k >>> 16) & 0xff
        state[c * 4 + 2] ^= (k >>> 8) & 0xff
        state[c * 4 + 3] ^= k & 0xff
    }
}

function subBytes(state, box) {
    for (let i = 0; i < 16; i++) state[i] = box[state[i]]
}

function shiftRows(state) {
    // 行 r 左移 r 字节（state 列主序：索引 = 4*列 + 行）
    let tmp
    tmp = state[1]; state[1] = state[5]; state[5] = state[9]; state[9] = state[13]; state[13] = tmp
    tmp = state[2]; state[2] = state[10]; state[10] = tmp
    tmp = state[6]; state[6] = state[14]; state[14] = tmp
    tmp = state[15]; state[15] = state[11]; state[11] = state[7]; state[7] = state[3]; state[3] = tmp
}

function invShiftRows(state) {
    let tmp
    tmp = state[13]; state[13] = state[9]; state[9] = state[5]; state[5] = state[1]; state[1] = tmp
    tmp = state[2]; state[2] = state[10]; state[10] = tmp
    tmp = state[6]; state[6] = state[14]; state[14] = tmp
    tmp = state[3]; state[3] = state[7]; state[7] = state[11]; state[11] = state[15]; state[15] = tmp
}

function mixColumns(state) {
    const m2 = TABLES.mul[2]
    const m3 = TABLES.mul[3]
    for (let c = 0; c < 4; c++) {
        const i = c * 4
        const a0 = state[i], a1 = state[i + 1], a2 = state[i + 2], a3 = state[i + 3]
        state[i] = m2[a0] ^ m3[a1] ^ a2 ^ a3
        state[i + 1] = a0 ^ m2[a1] ^ m3[a2] ^ a3
        state[i + 2] = a0 ^ a1 ^ m2[a2] ^ m3[a3]
        state[i + 3] = m3[a0] ^ a1 ^ a2 ^ m2[a3]
    }
}

function invMixColumns(state) {
    const m9 = TABLES.mul[9]
    const m11 = TABLES.mul[11]
    const m13 = TABLES.mul[13]
    const m14 = TABLES.mul[14]
    for (let c = 0; c < 4; c++) {
        const i = c * 4
        const a0 = state[i], a1 = state[i + 1], a2 = state[i + 2], a3 = state[i + 3]
        state[i] = m14[a0] ^ m11[a1] ^ m13[a2] ^ m9[a3]
        state[i + 1] = m9[a0] ^ m14[a1] ^ m11[a2] ^ m13[a3]
        state[i + 2] = m13[a0] ^ m9[a1] ^ m14[a2] ^ m11[a3]
        state[i + 3] = m11[a0] ^ m13[a1] ^ m9[a2] ^ m14[a3]
    }
}

function encryptBlock(block, ctx) {
    const { roundKeys, rounds } = ctx
    addRoundKey(block, roundKeys, 0)
    for (let r = 1; r < rounds; r++) {
        subBytes(block, TABLES.sbox)
        shiftRows(block)
        mixColumns(block)
        addRoundKey(block, roundKeys, r)
    }
    subBytes(block, TABLES.sbox)
    shiftRows(block)
    addRoundKey(block, roundKeys, rounds)
}

function decryptBlock(block, ctx) {
    const { roundKeys, rounds } = ctx
    addRoundKey(block, roundKeys, rounds)
    for (let r = rounds - 1; r >= 1; r--) {
        invShiftRows(block)
        subBytes(block, TABLES.invSbox)
        addRoundKey(block, roundKeys, r)
        invMixColumns(block)
    }
    invShiftRows(block)
    subBytes(block, TABLES.invSbox)
    addRoundKey(block, roundKeys, 0)
}

function pkcs7Pad(data) {
    const pad = 16 - (data.length % 16)
    const out = new Uint8Array(data.length + pad)
    out.set(data)
    for (let i = data.length; i < out.length; i++) out[i] = pad
    return out
}

function pkcs7Unpad(data) {
    if (!data.length || data.length % 16 !== 0) throw new Error('密文长度异常')
    const pad = data[data.length - 1]
    if (pad < 1 || pad > 16) throw new Error('填充非法（密钥可能不正确）')
    for (let i = data.length - pad; i < data.length; i++) {
        if (data[i] !== pad) throw new Error('填充非法（密钥可能不正确）')
    }
    return data.slice(0, data.length - pad)
}

/** AES-256-CBC 加密，iv 必须 16 字节 */
export function aesCbcEncrypt(key, iv, plaintext) {
    const ctx = expandKey(key)
    if (iv.length !== 16) throw new Error('IV 必须 16 字节')
    const data = pkcs7Pad(plaintext)
    const out = new Uint8Array(data.length)
    let prev = new Uint8Array(iv)
    for (let off = 0; off < data.length; off += 16) {
        const block = new Uint8Array(16)
        for (let i = 0; i < 16; i++) block[i] = data[off + i] ^ prev[i]
        encryptBlock(block, ctx)
        out.set(block, off)
        prev = block
    }
    return out
}

/** AES-256-CBC 解密 */
export function aesCbcDecrypt(key, iv, ciphertext) {
    const ctx = expandKey(key)
    if (iv.length !== 16) throw new Error('IV 必须 16 字节')
    if (ciphertext.length % 16 !== 0) throw new Error('密文长度异常')
    const out = new Uint8Array(ciphertext.length)
    let prev = new Uint8Array(iv)
    for (let off = 0; off < ciphertext.length; off += 16) {
        const block = ciphertext.slice(off, off + 16)
        const dec = new Uint8Array(block)
        decryptBlock(dec, ctx)
        for (let i = 0; i < 16; i++) out[off + i] = dec[i] ^ prev[i]
        prev = block
    }
    return pkcs7Unpad(out)
}
