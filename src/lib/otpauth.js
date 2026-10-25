// otpauth:// 链接解析与生成
import { normalizeSecret, validateSecret } from './base32.js'
import { ALGORITHMS, DEFAULT_DIGITS, DEFAULT_PERIOD } from './totp.js'

function safeDecode(text) {
    try {
        return decodeURIComponent(String(text || '').replace(/\+/g, ' '))
    } catch (e) {
        return String(text || '')
    }
}

function parseQuery(query) {
    const out = {}
    if (!query) return out
    for (const pair of query.split('&')) {
        if (!pair) continue
        const idx = pair.indexOf('=')
        const key = idx < 0 ? pair : pair.slice(0, idx)
        const value = idx < 0 ? '' : pair.slice(idx + 1)
        out[safeDecode(key).toLowerCase()] = safeDecode(value)
    }
    return out
}

/** 解析 otpauth:// 或裸 Base32 密钥，返回账号草稿 */
export function parseOtpInput(input) {
    const text = String(input || '').trim()
    if (!text) throw new Error('内容为空')

    if (!/^otpauth:\/\//i.test(text)) {
        const secret = normalizeSecret(text)
        const err = validateSecret(secret)
        if (err) throw new Error(err)
        return { type: 'totp', issuer: '', account: '', secret, algorithm: 'SHA1', digits: DEFAULT_DIGITS, period: DEFAULT_PERIOD }
    }

    const match = /^otpauth:\/\/(totp|hotp)\/([^?#]*)(?:\?([^#]*))?/i.exec(text)
    if (!match) throw new Error('无法识别的 otpauth 链接')
    const type = match[1].toLowerCase()
    const label = safeDecode(match[2] || '')
    const params = parseQuery(match[3] || '')

    let issuer = params.issuer || ''
    let account = label
    const sep = label.indexOf(':')
    if (sep >= 0) {
        const labelIssuer = label.slice(0, sep).trim()
        account = label.slice(sep + 1).trim()
        if (!issuer) issuer = labelIssuer
    }

    const secret = normalizeSecret(params.secret || '')
    const err = validateSecret(secret)
    if (err) throw new Error(err)

    const algorithm = ALGORITHMS.indexOf(String(params.algorithm || '').toUpperCase()) >= 0
        ? String(params.algorithm).toUpperCase()
        : 'SHA1'
    const digits = Number(params.digits) === 8 ? 8 : DEFAULT_DIGITS
    const period = Number(params.period) > 0 ? Number(params.period) : DEFAULT_PERIOD
    const counter = Number(params.counter) >= 0 ? Number(params.counter) : 0

    return {
        type,
        issuer: issuer.slice(0, 40),
        account: account.slice(0, 60),
        secret,
        algorithm,
        digits,
        period,
        counter
    }
}

export function buildOtpUri(item) {
    const issuer = String(item.issuer || '').trim()
    const account = String(item.account || '').trim()
    const label = encodeURIComponent((issuer ? issuer + ':' : '') + (account || 'account')).replace(/%3A/g, ':')
    const params = ['secret=' + normalizeSecret(item.secret)]
    if (issuer) params.push('issuer=' + encodeURIComponent(issuer))
    if (item.algorithm && item.algorithm !== 'SHA1') params.push('algorithm=' + item.algorithm)
    if (Number(item.digits) && Number(item.digits) !== DEFAULT_DIGITS) params.push('digits=' + item.digits)
    if (Number(item.period) && Number(item.period) !== DEFAULT_PERIOD) params.push('period=' + item.period)
    if (item.type === 'hotp') params.push('counter=' + (item.counter || 0))
    return `otpauth://${item.type === 'hotp' ? 'hotp' : 'totp'}/${label}?${params.join('&')}`
}

/** 从 Aegis / 2FAS 等导出的纯文本里逐行提取链接 */
export function extractUris(text) {
    const found = []
    const re = /otpauth:\/\/[^\s"'<>]+/gi
    let m
    while ((m = re.exec(String(text || '')))) found.push(m[0])
    return found
}
