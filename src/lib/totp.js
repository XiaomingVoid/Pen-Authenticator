// HOTP / TOTP（RFC 4226 / 6238）
import { hmac } from './hash.js'
import { base32Decode, normalizeSecret } from './base32.js'

export const ALGORITHMS = ['SHA1', 'SHA256', 'SHA512']
export const DEFAULT_PERIOD = 30
export const DEFAULT_DIGITS = 6

export function padStart(text, len, ch) {
    let out = String(text)
    while (out.length < len) out = ch + out
    return out
}

function counterBytes(counter) {
    const buf = new Uint8Array(8)
    let c = Math.floor(counter)
    for (let i = 7; i >= 0; i--) {
        buf[i] = c % 256
        c = Math.floor(c / 256)
    }
    return buf
}

/** HOTP：RFC 4226 动态截断 */
export function hotp(keyBytes, counter, digits = DEFAULT_DIGITS, algorithm = 'SHA1') {
    const mac = hmac(algorithm, keyBytes, counterBytes(counter))
    const offset = mac[mac.length - 1] & 0x0f
    const binary = ((mac[offset] & 0x7f) << 24) |
        ((mac[offset + 1] & 0xff) << 16) |
        ((mac[offset + 2] & 0xff) << 8) |
        (mac[offset + 3] & 0xff)
    const mod = Math.pow(10, digits)
    return padStart(binary % mod, digits, '0')
}

/** 由 base32 密钥计算时间片内验证码 */
export function totpFromSecret(secret, options = {}, nowMs = Date.now()) {
    const period = Number(options.period) > 0 ? Number(options.period) : DEFAULT_PERIOD
    const digits = Number(options.digits) > 0 ? Number(options.digits) : DEFAULT_DIGITS
    const algorithm = ALGORITHMS.indexOf(options.algorithm) >= 0 ? options.algorithm : 'SHA1'
    const key = secret instanceof Uint8Array ? secret : base32Decode(normalizeSecret(secret))
    const seconds = Math.floor(nowMs / 1000)
    const counter = Math.floor(seconds / period)
    const code = hotp(key, counter, digits, algorithm)
    const elapsed = seconds % period
    const remaining = period - elapsed
    return {
        code,
        counter,
        digits,
        period,
        remaining,
        progress: remaining / period,
        expiresAt: (counter + 1) * period * 1000
    }
}

/** 分组显示：6 位 -> 123 456；8 位 -> 1234 5678 */
export function formatCode(code) {
    const text = String(code || '')
    if (text.length === 6) return text.slice(0, 3) + ' ' + text.slice(3)
    if (text.length === 8) return text.slice(0, 4) + ' ' + text.slice(4)
    return text
}

/** 校验一个验证码是否在 ±window 个时间片内（用于导入自检） */
export function verify(code, secret, options = {}, windowSlots = 1, nowMs = Date.now()) {
    const period = Number(options.period) > 0 ? Number(options.period) : DEFAULT_PERIOD
    const key = secret instanceof Uint8Array ? secret : base32Decode(normalizeSecret(secret))
    const counter = Math.floor(nowMs / 1000 / period)
    for (let i = -windowSlots; i <= windowSlots; i++) {
        if (hotp(key, counter + i, options.digits || DEFAULT_DIGITS, options.algorithm || 'SHA1') === String(code)) return true
    }
    return false
}
