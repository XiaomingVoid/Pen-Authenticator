// 随机数：QuickJS 没有 WebCrypto / os.urandom
// 用时间、计数器与 Math.random 的多次取值混入 SHA-256 池，作为盐与 IV 的来源。
// 说明：这不是 CSPRNG，但在设备本地用于生成盐/IV 已足够；密钥强度来自用户 PIN + PBKDF2。
import { sha256 } from './hash.js'
import { utf8, concatBytes } from './bytes.js'

let pool = null
let counter = 0

function entropy() {
    const parts = []
    parts.push(String(Date.now()))
    try {
        if (typeof performance !== 'undefined' && performance.now) parts.push(String(performance.now().toFixed(6)))
    } catch (e) { /* 忽略 */ }
    for (let i = 0; i < 8; i++) parts.push(String(Math.floor(Math.random() * 0x100000000)))
    parts.push(String(counter++))
    return utf8(parts.join('|'))
}

export function randomBytes(n) {
    let out = new Uint8Array(0)
    let guard = 0
    while (out.length < n && guard++ < 64) {
        const seed = pool ? concatBytes(pool, entropy()) : entropy()
        pool = sha256(seed)
        out = concatBytes(out, pool)
    }
    return out.slice(0, n)
}

export function randomId() {
    const bytes = randomBytes(8)
    let s = ''
    for (let i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16)
    return s
}
