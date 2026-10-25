// 纯 JS 字节工具（QuickJS 环境没有 TextEncoder/Buffer）

/** UTF-8 编码 */
export function utf8(str) {
    const out = []
    for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i)
        if (c < 0x80) {
            out.push(c)
        } else if (c < 0x800) {
            out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f))
        } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
            const next = str.charCodeAt(i + 1)
            if (next >= 0xdc00 && next <= 0xdfff) {
                i++
                const cp = 0x10000 + ((c - 0xd800) << 10) + (next - 0xdc00)
                out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
            } else {
                out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
            }
        } else {
            out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
        }
    }
    return new Uint8Array(out)
}

/** UTF-8 解码 */
export function utf8Decode(bytes) {
    let out = ''
    for (let i = 0; i < bytes.length; i++) {
        const b = bytes[i]
        if (b < 0x80) {
            out += String.fromCharCode(b)
        } else if (b < 0xe0) {
            out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[++i] & 0x3f))
        } else if (b < 0xf0) {
            const c = ((b & 0x0f) << 12) | ((bytes[++i] & 0x3f) << 6) | (bytes[++i] & 0x3f)
            out += String.fromCharCode(c)
        } else {
            const cp = ((b & 0x07) << 18) | ((bytes[++i] & 0x3f) << 12) | ((bytes[++i] & 0x3f) << 6) | (bytes[++i] & 0x3f)
            const v = cp - 0x10000
            out += String.fromCharCode(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff))
        }
    }
    return out
}

/** 拼接多个字节数组 */
export function concatBytes(...parts) {
    let size = 0
    for (const p of parts) size += p.length
    const out = new Uint8Array(size)
    let off = 0
    for (const p of parts) {
        out.set(p, off)
        off += p.length
    }
    return out
}

export function bytesToHex(bytes) {
    let s = ''
    for (let i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16)
    return s
}

export function hexToBytes(hex) {
    const clean = String(hex).replace(/[^0-9a-fA-F]/g, '')
    const out = new Uint8Array(clean.length >> 1)
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16)
    return out
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function bytesToBase64(bytes) {
    let out = ''
    for (let i = 0; i < bytes.length; i += 3) {
        const b0 = bytes[i]
        const b1 = bytes[i + 1]
        const b2 = bytes[i + 2]
        out += B64[b0 >> 2]
        out += B64[((b0 & 3) << 4) | ((b1 === undefined ? 0 : b1) >> 4)]
        out += b1 === undefined ? '=' : B64[((b1 & 15) << 2) | ((b2 === undefined ? 0 : b2) >> 6)]
        out += b2 === undefined ? '=' : B64[b2 & 63]
    }
    return out
}

// 解码走查表 + 预分配 + 一次处理 4 个字符：真机实测 43.5KB 文本从 51ms 降到 32ms
const B64_LOOKUP = (() => {
    const table = new Int16Array(256).fill(-1)
    for (let i = 0; i < B64.length; i++) table[B64.charCodeAt(i) & 0xff] = i
    return table
})()

export function base64ToBytes(text) {
    const s = String(text)
    const len = s.length
    const out = new Uint8Array((len >> 2) * 3)
    let o = 0
    for (let i = 0; i < len; i += 4) {
        const c2 = B64_LOOKUP[s.charCodeAt(i + 2) & 0xff]
        const c3 = B64_LOOKUP[s.charCodeAt(i + 3) & 0xff]
        const v = (B64_LOOKUP[s.charCodeAt(i) & 0xff] << 18) |
            (B64_LOOKUP[s.charCodeAt(i + 1) & 0xff] << 12) |
            ((c2 < 0 ? 0 : c2) << 6) |
            (c3 < 0 ? 0 : c3)
        out[o++] = (v >> 16) & 0xff
        out[o++] = (v >> 8) & 0xff
        out[o++] = v & 0xff
    }
    // 尾部 '=' 填充：base64 长度一定是 4 的倍数，填充 0/1/2 个
    let real = out.length
    if (len >= 2 && s.charCodeAt(len - 1) === 61) real -= 1
    if (len >= 3 && s.charCodeAt(len - 2) === 61) real -= 1
    return real === out.length ? out : out.subarray(0, real)
}

/**
 * base64 → 字节（分块让出版本）。
 * 相机灰度帧 base64 有 11 万字符，同步解码要 ~80ms，会把 24fps 预览循环饿死。
 * 按 32K 字符（≈20ms）一块，块间 await yieldFn()，让预览循环插空跑。
 */
export async function base64ToBytesAsync(text, yieldFn) {
    const s = String(text)
    const len = s.length
    const out = new Uint8Array((len >> 2) * 3)
    let o = 0
    const CHUNK = 32768
    for (let base = 0; base < len; base += CHUNK) {
        const end = base + CHUNK < len ? base + CHUNK : len
        for (let i = base; i < end; i += 4) {
            const c2 = B64_LOOKUP[s.charCodeAt(i + 2) & 0xff]
            const c3 = B64_LOOKUP[s.charCodeAt(i + 3) & 0xff]
            const v = (B64_LOOKUP[s.charCodeAt(i) & 0xff] << 18) |
                (B64_LOOKUP[s.charCodeAt(i + 1) & 0xff] << 12) |
                ((c2 < 0 ? 0 : c2) << 6) |
                (c3 < 0 ? 0 : c3)
            out[o++] = (v >> 16) & 0xff
            out[o++] = (v >> 8) & 0xff
            out[o++] = v & 0xff
        }
        if (end < len && yieldFn) await yieldFn()
    }
    let real = out.length
    if (len >= 2 && s.charCodeAt(len - 1) === 61) real -= 1
    if (len >= 3 && s.charCodeAt(len - 2) === 61) real -= 1
    return real === out.length ? out : out.subarray(0, real)
}

/** 常数时间比较，避免口令/密钥比较泄露时序 */
export function timingSafeEqual(a, b) {
    if (!a || !b || a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
    return diff === 0
}

/** 清零敏感字节 */
export function wipe(bytes) {
    if (bytes && bytes.fill) bytes.fill(0)
}
