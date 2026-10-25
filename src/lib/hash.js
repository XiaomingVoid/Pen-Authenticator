// SHA-1 / SHA-256 / SHA-512 纯 JS 实现（QuickJS 无 WebCrypto）
// 常量表由素数立方根/平方根小数部分生成（tools/gen_constants.mjs），已与标准值核对。
import { utf8, concatBytes } from './bytes.js'

const K256 = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
])

const H256 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]

const K512_SRC = [
    '0x428a2f98d728ae22', '0x7137449123ef65cd', '0xb5c0fbcfec4d3b2f', '0xe9b5dba58189dbbc',
    '0x3956c25bf348b538', '0x59f111f1b605d019', '0x923f82a4af194f9b', '0xab1c5ed5da6d8118',
    '0xd807aa98a3030242', '0x12835b0145706fbe', '0x243185be4ee4b28c', '0x550c7dc3d5ffb4e2',
    '0x72be5d74f27b896f', '0x80deb1fe3b1696b1', '0x9bdc06a725c71235', '0xc19bf174cf692694',
    '0xe49b69c19ef14ad2', '0xefbe4786384f25e3', '0x0fc19dc68b8cd5b5', '0x240ca1cc77ac9c65',
    '0x2de92c6f592b0275', '0x4a7484aa6ea6e483', '0x5cb0a9dcbd41fbd4', '0x76f988da831153b5',
    '0x983e5152ee66dfab', '0xa831c66d2db43210', '0xb00327c898fb213f', '0xbf597fc7beef0ee4',
    '0xc6e00bf33da88fc2', '0xd5a79147930aa725', '0x06ca6351e003826f', '0x142929670a0e6e70',
    '0x27b70a8546d22ffc', '0x2e1b21385c26c926', '0x4d2c6dfc5ac42aed', '0x53380d139d95b3df',
    '0x650a73548baf63de', '0x766a0abb3c77b2a8', '0x81c2c92e47edaee6', '0x92722c851482353b',
    '0xa2bfe8a14cf10364', '0xa81a664bbc423001', '0xc24b8b70d0f89791', '0xc76c51a30654be30',
    '0xd192e819d6ef5218', '0xd69906245565a910', '0xf40e35855771202a', '0x106aa07032bbd1b8',
    '0x19a4c116b8d2d0c8', '0x1e376c085141ab53', '0x2748774cdf8eeb99', '0x34b0bcb5e19b48a8',
    '0x391c0cb3c5c95a63', '0x4ed8aa4ae3418acb', '0x5b9cca4f7763e373', '0x682e6ff3d6b2b8a3',
    '0x748f82ee5defb2fc', '0x78a5636f43172f60', '0x84c87814a1f0ab72', '0x8cc702081a6439ec',
    '0x90befffa23631e28', '0xa4506cebde82bde9', '0xbef9a3f7b2c67915', '0xc67178f2e372532b',
    '0xca273eceea26619c', '0xd186b8c721c0c207', '0xeada7dd6cde0eb1e', '0xf57d4f7fee6ed178',
    '0x06f067aa72176fba', '0x0a637dc5a2c898a6', '0x113f9804bef90dae', '0x1b710b35131c471b',
    '0x28db77f523047d84', '0x32caab7b40c72493', '0x3c9ebe0a15c9bebc', '0x431d67c49c100d4c',
    '0x4cc5d4becb3e42b6', '0x597f299cfc657e2a', '0x5fcb6fab3ad6faec', '0x6c44198c4a475817'
]
const H512_SRC = [
    '0x6a09e667f3bcc908', '0xbb67ae8584caa73b', '0x3c6ef372fe94f82b', '0xa54ff53a5f1d36f1',
    '0x510e527fade682d1', '0x9b05688c2b3e6c1f', '0x1f83d9abfb41bd6b', '0x5be0cd19137e2179'
]

const MASK64 = null // 64 位运算用高/低 32 位双字模拟，见下方 sha512

const rotr32 = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0

function pad64(message) {
    const len = message.length
    const total = ((len + 9 + 63) >>> 6) << 6
    const buf = new Uint8Array(total)
    buf.set(message)
    buf[len] = 0x80
    const bits = len * 8
    const hi = Math.floor(bits / 4294967296)
    const lo = bits >>> 0
    buf[total - 8] = (hi >>> 24) & 0xff
    buf[total - 7] = (hi >>> 16) & 0xff
    buf[total - 6] = (hi >>> 8) & 0xff
    buf[total - 5] = hi & 0xff
    buf[total - 4] = (lo >>> 24) & 0xff
    buf[total - 3] = (lo >>> 16) & 0xff
    buf[total - 2] = (lo >>> 8) & 0xff
    buf[total - 1] = lo & 0xff
    return buf
}

export function sha256(input) {
    const message = input instanceof Uint8Array ? input : utf8(String(input))
    const buf = pad64(message)
    const w = new Uint32Array(64)
    let h0 = H256[0], h1 = H256[1], h2 = H256[2], h3 = H256[3]
    let h4 = H256[4], h5 = H256[5], h6 = H256[6], h7 = H256[7]

    for (let off = 0; off < buf.length; off += 64) {
        for (let i = 0; i < 16; i++) {
            const p = off + i * 4
            w[i] = (buf[p] << 24) | (buf[p + 1] << 16) | (buf[p + 2] << 8) | buf[p + 3]
        }
        for (let i = 16; i < 64; i++) {
            const x = w[i - 15]
            const y = w[i - 2]
            const s0 = rotr32(x, 7) ^ rotr32(x, 18) ^ (x >>> 3)
            const s1 = rotr32(y, 17) ^ rotr32(y, 19) ^ (y >>> 10)
            w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
        }
        let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7
        for (let i = 0; i < 64; i++) {
            const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25)
            const ch = (e & f) ^ (~e & g)
            const t1 = (h + S1 + ch + K256[i] + w[i]) >>> 0
            const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22)
            const maj = (a & b) ^ (a & c) ^ (b & c)
            const t2 = (S0 + maj) >>> 0
            h = g; g = f; f = e
            e = (d + t1) >>> 0
            d = c; c = b; b = a
            a = (t1 + t2) >>> 0
        }
        h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0
        h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0
    }

    const out = new Uint8Array(32)
    const hs = [h0, h1, h2, h3, h4, h5, h6, h7]
    for (let i = 0; i < 8; i++) {
        out[i * 4] = (hs[i] >>> 24) & 0xff
        out[i * 4 + 1] = (hs[i] >>> 16) & 0xff
        out[i * 4 + 2] = (hs[i] >>> 8) & 0xff
        out[i * 4 + 3] = hs[i] & 0xff
    }
    return out
}

export function sha1(input) {
    const message = input instanceof Uint8Array ? input : utf8(String(input))
    const buf = pad64(message)
    const w = new Uint32Array(80)
    let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0

    for (let off = 0; off < buf.length; off += 64) {
        for (let i = 0; i < 16; i++) {
            const p = off + i * 4
            w[i] = (buf[p] << 24) | (buf[p + 1] << 16) | (buf[p + 2] << 8) | buf[p + 3]
        }
        for (let i = 16; i < 80; i++) {
            const v = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]
            w[i] = ((v << 1) | (v >>> 31)) >>> 0
        }
        let a = h0, b = h1, c = h2, d = h3, e = h4
        for (let i = 0; i < 80; i++) {
            let f, k
            if (i < 20) {
                f = (b & c) | (~b & d)
                k = 0x5a827999
            } else if (i < 40) {
                f = b ^ c ^ d
                k = 0x6ed9eba1
            } else if (i < 60) {
                f = (b & c) | (b & d) | (c & d)
                k = 0x8f1bbcdc
            } else {
                f = b ^ c ^ d
                k = 0xca62c1d6
            }
            const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[i]) >>> 0
            e = d
            d = c
            c = ((b << 30) | (b >>> 2)) >>> 0
            b = a
            a = temp
        }
        h0 = (h0 + a) >>> 0
        h1 = (h1 + b) >>> 0
        h2 = (h2 + c) >>> 0
        h3 = (h3 + d) >>> 0
        h4 = (h4 + e) >>> 0
    }

    const out = new Uint8Array(20)
    const hs = [h0, h1, h2, h3, h4]
    for (let i = 0; i < 5; i++) {
        out[i * 4] = (hs[i] >>> 24) & 0xff
        out[i * 4 + 1] = (hs[i] >>> 16) & 0xff
        out[i * 4 + 2] = (hs[i] >>> 8) & 0xff
        out[i * 4 + 3] = hs[i] & 0xff
    }
    return out
}

// ---- SHA-512：用高/低 32 位双字模拟 64 位运算（不依赖 BigInt） ----
function split64(hexList, count) {
    const hi = new Uint32Array(count)
    const lo = new Uint32Array(count)
    for (let i = 0; i < count; i++) {
        const text = hexList[i].slice(2)
        hi[i] = parseInt(text.slice(0, 8), 16) >>> 0
        lo[i] = parseInt(text.slice(8, 16), 16) >>> 0
    }
    return { hi, lo }
}

const K512 = split64(K512_SRC, 80)
const H512 = split64(H512_SRC, 8)

// 双字右旋/右移：结果放在模块级临时变量，避免每轮分配对象
let rH = 0
let rL = 0

function rotr64(h, l, n) {
    if (n < 32) {
        rH = ((h >>> n) | (l << (32 - n))) >>> 0
        rL = ((l >>> n) | (h << (32 - n))) >>> 0
    } else {
        const m = n - 32
        rH = ((l >>> m) | (h << (32 - m))) >>> 0
        rL = ((h >>> m) | (l << (32 - m))) >>> 0
    }
}

function shr64(h, l, n) {
    rH = h >>> n
    rL = ((l >>> n) | (h << (32 - n))) >>> 0
}

export function sha512(input) {
    const message = input instanceof Uint8Array ? input : utf8(String(input))
    const len = message.length
    const total = ((len + 17 + 127) >>> 7) << 7
    const buf = new Uint8Array(total)
    buf.set(message)
    buf[len] = 0x80
    const bitsHi = Math.floor(len / 536870912) >>> 0
    const bitsLo = (len * 8) >>> 0
    buf[total - 8] = (bitsHi >>> 24) & 0xff
    buf[total - 7] = (bitsHi >>> 16) & 0xff
    buf[total - 6] = (bitsHi >>> 8) & 0xff
    buf[total - 5] = bitsHi & 0xff
    buf[total - 4] = (bitsLo >>> 24) & 0xff
    buf[total - 3] = (bitsLo >>> 16) & 0xff
    buf[total - 2] = (bitsLo >>> 8) & 0xff
    buf[total - 1] = bitsLo & 0xff

    const whi = new Uint32Array(80)
    const wlo = new Uint32Array(80)
    let h0h = H512.hi[0], h0l = H512.lo[0]
    let h1h = H512.hi[1], h1l = H512.lo[1]
    let h2h = H512.hi[2], h2l = H512.lo[2]
    let h3h = H512.hi[3], h3l = H512.lo[3]
    let h4h = H512.hi[4], h4l = H512.lo[4]
    let h5h = H512.hi[5], h5l = H512.lo[5]
    let h6h = H512.hi[6], h6l = H512.lo[6]
    let h7h = H512.hi[7], h7l = H512.lo[7]

    for (let off = 0; off < buf.length; off += 128) {
        for (let i = 0; i < 16; i++) {
            const p = off + i * 8
            whi[i] = ((buf[p] << 24) | (buf[p + 1] << 16) | (buf[p + 2] << 8) | buf[p + 3]) >>> 0
            wlo[i] = ((buf[p + 4] << 24) | (buf[p + 5] << 16) | (buf[p + 6] << 8) | buf[p + 7]) >>> 0
        }
        for (let i = 16; i < 80; i++) {
            // s0 = rotr(w[i-15],1) ^ rotr(w[i-15],8) ^ shr(w[i-15],7)
            let ah = whi[i - 15], al = wlo[i - 15]
            rotr64(ah, al, 1)
            let s0h = rH, s0l = rL
            rotr64(ah, al, 8)
            s0h = (s0h ^ rH) >>> 0
            s0l = (s0l ^ rL) >>> 0
            shr64(ah, al, 7)
            s0h = (s0h ^ rH) >>> 0
            s0l = (s0l ^ rL) >>> 0
            // s1 = rotr(w[i-2],19) ^ rotr(w[i-2],61) ^ shr(w[i-2],6)
            const bh = whi[i - 2], bl = wlo[i - 2]
            rotr64(bh, bl, 19)
            let s1h = rH, s1l = rL
            rotr64(bh, bl, 61)
            s1h = (s1h ^ rH) >>> 0
            s1l = (s1l ^ rL) >>> 0
            shr64(bh, bl, 6)
            s1h = (s1h ^ rH) >>> 0
            s1l = (s1l ^ rL) >>> 0
            // w[i] = w[i-16] + s0 + w[i-7] + s1
            let lo = (wlo[i - 16] + s0l) >>> 0
            let carry = lo < wlo[i - 16] ? 1 : 0
            let hi = (whi[i - 16] + s0h + carry) >>> 0
            lo = (lo + wlo[i - 7]) >>> 0
            const prev = (lo - wlo[i - 7]) >>> 0
            carry = lo < prev ? 1 : 0
            hi = (hi + whi[i - 7] + carry) >>> 0
            lo = (lo + s1l) >>> 0
            carry = lo < s1l ? 1 : 0
            hi = (hi + s1h + carry) >>> 0
            whi[i] = hi
            wlo[i] = lo
        }

        let ah = h0h, al = h0l, bh = h1h, bl = h1l, ch = h2h, cl = h2l, dh = h3h, dl = h3l
        let eh = h4h, el = h4l, fh = h5h, fl = h5l, gh = h6h, gl = h6l, hh = h7h, hl = h7l
        for (let i = 0; i < 80; i++) {
            // S1 = rotr(e,14) ^ rotr(e,18) ^ rotr(e,41)
            rotr64(eh, el, 14)
            let S1h = rH, S1l = rL
            rotr64(eh, el, 18)
            S1h = (S1h ^ rH) >>> 0
            S1l = (S1l ^ rL) >>> 0
            rotr64(eh, el, 41)
            S1h = (S1h ^ rH) >>> 0
            S1l = (S1l ^ rL) >>> 0
            const chh = ((eh & fh) ^ (~eh & gh)) >>> 0
            const chl = ((el & fl) ^ (~el & gl)) >>> 0

            // t1 = h + S1 + ch + K[i] + W[i]
            let lo = (hl + S1l) >>> 0
            let carry = lo < hl ? 1 : 0
            let hi = (hh + S1h + carry) >>> 0
            lo = (lo + chl) >>> 0
            carry = lo < chl ? 1 : 0
            hi = (hi + chh + carry) >>> 0
            lo = (lo + wlo[i]) >>> 0
            carry = lo < wlo[i] ? 1 : 0
            hi = (hi + whi[i] + carry) >>> 0
            lo = (lo + K512.lo[i]) >>> 0
            carry = lo < K512.lo[i] ? 1 : 0
            hi = (hi + K512.hi[i] + carry) >>> 0
            const t1h = hi, t1l = lo

            // S0 = rotr(a,28) ^ rotr(a,34) ^ rotr(a,39)
            rotr64(ah, al, 28)
            let S0h = rH, S0l = rL
            rotr64(ah, al, 34)
            S0h = (S0h ^ rH) >>> 0
            S0l = (S0l ^ rL) >>> 0
            rotr64(ah, al, 39)
            S0h = (S0h ^ rH) >>> 0
            S0l = (S0l ^ rL) >>> 0
            const majh = ((ah & bh) ^ (ah & ch) ^ (bh & ch)) >>> 0
            const majl = ((al & bl) ^ (al & cl) ^ (bl & cl)) >>> 0
            // t2 = S0 + maj
            let t2l = (S0l + majl) >>> 0
            let t2c = t2l < S0l ? 1 : 0
            const t2h = (S0h + majh + t2c) >>> 0

            hh = gh; hl = gl
            gh = fh; gl = fl
            fh = eh; fl = el
            // e = d + t1
            el = (dl + t1l) >>> 0
            const ec = el < dl ? 1 : 0
            eh = (dh + t1h + ec) >>> 0
            dh = ch; dl = cl
            ch = bh; cl = bl
            bh = ah; bl = al
            // a = t1 + t2
            al = (t1l + t2l) >>> 0
            const ac = al < t1l ? 1 : 0
            ah = (t1h + t2h + ac) >>> 0
        }

        h0l = (h0l + al) >>> 0; h0h = (h0h + ah + (h0l < al ? 1 : 0)) >>> 0
        h1l = (h1l + bl) >>> 0; h1h = (h1h + bh + (h1l < bl ? 1 : 0)) >>> 0
        h2l = (h2l + cl) >>> 0; h2h = (h2h + ch + (h2l < cl ? 1 : 0)) >>> 0
        h3l = (h3l + dl) >>> 0; h3h = (h3h + dh + (h3l < dl ? 1 : 0)) >>> 0
        h4l = (h4l + el) >>> 0; h4h = (h4h + eh + (h4l < el ? 1 : 0)) >>> 0
        h5l = (h5l + fl) >>> 0; h5h = (h5h + fh + (h5l < fl ? 1 : 0)) >>> 0
        h6l = (h6l + gl) >>> 0; h6h = (h6h + gh + (h6l < gl ? 1 : 0)) >>> 0
        h7l = (h7l + hl) >>> 0; h7h = (h7h + hh + (h7l < hl ? 1 : 0)) >>> 0
    }

    const out = new Uint8Array(64)
    const hs = [[h0h, h0l], [h1h, h1l], [h2h, h2l], [h3h, h3l], [h4h, h4l], [h5h, h5l], [h6h, h6l], [h7h, h7l]]
    for (let i = 0; i < 8; i++) {
        const [hi, lo] = hs[i]
        out[i * 8] = (hi >>> 24) & 0xff
        out[i * 8 + 1] = (hi >>> 16) & 0xff
        out[i * 8 + 2] = (hi >>> 8) & 0xff
        out[i * 8 + 3] = hi & 0xff
        out[i * 8 + 4] = (lo >>> 24) & 0xff
        out[i * 8 + 5] = (lo >>> 16) & 0xff
        out[i * 8 + 6] = (lo >>> 8) & 0xff
        out[i * 8 + 7] = lo & 0xff
    }
    return out
}

export const HASHES = {
    SHA1: { fn: sha1, blockSize: 64, name: 'SHA1' },
    SHA256: { fn: sha256, blockSize: 64, name: 'SHA256' },
    SHA512: { fn: sha512, blockSize: 128, name: 'SHA512' }
}

export function hmac(hashName, key, message) {
    const spec = HASHES[hashName]
    if (!spec) throw new Error('不支持的算法: ' + hashName)
    const block = spec.blockSize
    let k = key instanceof Uint8Array ? key : utf8(String(key))
    if (k.length > block) k = spec.fn(k)
    const padded = new Uint8Array(block)
    padded.set(k)
    const inner = new Uint8Array(block)
    const outer = new Uint8Array(block)
    for (let i = 0; i < block; i++) {
        inner[i] = padded[i] ^ 0x36
        outer[i] = padded[i] ^ 0x5c
    }
    const msg = message instanceof Uint8Array ? message : utf8(String(message))
    return spec.fn(concatBytes(outer, spec.fn(concatBytes(inner, msg))))
}

/** PBKDF2（默认 HMAC-SHA256） */
export function pbkdf2(password, salt, iterations, keyLen, hashName = 'SHA256') {
    const spec = HASHES[hashName]
    if (!spec) throw new Error('不支持的算法: ' + hashName)
    const passBytes = password instanceof Uint8Array ? password : utf8(String(password))
    const saltBytes = salt instanceof Uint8Array ? salt : utf8(String(salt))
    const blocks = Math.ceil(keyLen / spec.fn(new Uint8Array(0)).length)
    const out = new Uint8Array(blocks * spec.fn(new Uint8Array(0)).length)
    for (let i = 1; i <= blocks; i++) {
        const idx = new Uint8Array([(i >>> 24) & 0xff, (i >>> 16) & 0xff, (i >>> 8) & 0xff, i & 0xff])
        let u = hmac(hashName, passBytes, concatBytes(saltBytes, idx))
        const t = new Uint8Array(u)
        for (let n = 1; n < iterations; n++) {
            u = hmac(hashName, passBytes, u)
            for (let b = 0; b < t.length; b++) t[b] ^= u[b]
        }
        out.set(t, (i - 1) * t.length)
    }
    return out.slice(0, keyLen)
}
