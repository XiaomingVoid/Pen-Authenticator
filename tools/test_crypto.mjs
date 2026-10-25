// 密码学与 TOTP 自测：node --experimental-default-type=module tools/test_crypto.mjs
import { createHash, createHmac, pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto'
import { sha1, sha256, sha512, hmac, pbkdf2 } from '../src/lib/hash.js'
import { aesCbcEncrypt, aesCbcDecrypt } from '../src/lib/aes.js'
import { base32Decode, base32Encode } from '../src/lib/base32.js'
import { totpFromSecret, formatCode, verify } from '../src/lib/totp.js'
import { parseOtpInput, buildOtpUri } from '../src/lib/otpauth.js'
import { utf8, bytesToHex, hexToBytes, bytesToBase64, base64ToBytes, utf8Decode } from '../src/lib/bytes.js'

let pass = 0
let fail = 0
function check(name, actual, expected) {
  const a = String(actual)
  const e = String(expected)
  if (a === e) {
    pass++
  } else {
    fail++
    console.log(`FAIL ${name}\n  got      ${a}\n  expected ${e}`)
  }
}

const hex = b => Buffer.from(b).toString('hex')
const nodeHash = (alg, data) => createHash(alg).update(data).digest('hex')
const nodeHmac = (alg, key, data) => createHmac(alg, key).update(data).digest('hex')

// ---------- 字节工具 ----------
check('utf8 ascii', hex(utf8('abc')), '616263')
check('utf8 cjk', hex(utf8('你好')), Buffer.from('你好', 'utf8').toString('hex'))
check('utf8 emoji', hex(utf8('😀')), Buffer.from('😀', 'utf8').toString('hex'))
check('utf8Decode', utf8Decode(utf8('中文😀abc')), '中文😀abc')
check('base64 rt', bytesToBase64(utf8('hello world')), Buffer.from('hello world').toString('base64'))
check('base64 decode', utf8Decode(base64ToBytes('aGVsbG8gd29ybGQ=')), 'hello world')
check('hex rt', bytesToHex(hexToBytes('deadbeef')), 'deadbeef')

// ---------- 哈希 ----------
for (const msg of ['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(1000)]) {
  const data = Buffer.from(msg, 'utf8')
  check(`sha1 ${msg.length}`, hex(sha1(utf8(msg))), nodeHash('sha1', data))
  check(`sha256 ${msg.length}`, hex(sha256(utf8(msg))), nodeHash('sha256', data))
  check(`sha512 ${msg.length}`, hex(sha512(utf8(msg))), nodeHash('sha512', data))
}
check('sha256 abc', hex(sha256(utf8('abc'))), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
check('sha256 中文', hex(sha256(utf8('中文测试'))), nodeHash('sha256', Buffer.from('中文测试')))
// 跨块长度：sha512 需要 128 字节块
for (const len of [111, 112, 127, 128, 129, 300]) {
  const s = 'x'.repeat(len)
  check(`sha512 len${len}`, hex(sha512(utf8(s))), nodeHash('sha512', Buffer.from(s)))
}

// ---------- HMAC ----------
for (const alg of ['SHA1', 'SHA256', 'SHA512']) {
  check(`hmac ${alg}`, hex(hmac(alg, utf8('key'), utf8('The quick brown fox jumps over the lazy dog'))),
    nodeHmac(alg.toLowerCase(), 'key', 'The quick brown fox jumps over the lazy dog'))
  // 长密钥（超过 block size）
  const longKey = 'k'.repeat(200)
  check(`hmac ${alg} longkey`, hex(hmac(alg, utf8(longKey), utf8('msg'))), nodeHmac(alg.toLowerCase(), longKey, 'msg'))
}

// ---------- PBKDF2 ----------
check('pbkdf2 1 iter', hex(pbkdf2('password', 'salt', 1, 32)), pbkdf2Sync('password', 'salt', 1, 32, 'sha256').toString('hex'))
check('pbkdf2 1000 iter', hex(pbkdf2('password', 'salt', 1000, 64)), pbkdf2Sync('password', 'salt', 1000, 64, 'sha256').toString('hex'))
check('pbkdf2 中文密码', hex(pbkdf2('密码123', '盐', 500, 32)), pbkdf2Sync('密码123', '盐', 500, 32, 'sha256').toString('hex'))

// ---------- AES-256-CBC ----------
for (const text of ['', 'hello', 'a'.repeat(16), 'a'.repeat(15), '中文内容测试 😀', 'x'.repeat(1000)]) {
  const key = randomBytes(32)
  const iv = randomBytes(16)
  const ct = aesCbcEncrypt(new Uint8Array(key), new Uint8Array(iv), utf8(text))
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  const expected = Buffer.concat([cipher.update(Buffer.from(text, 'utf8')), cipher.final()])
  check(`aes enc len${Buffer.byteLength(text)}`, hex(ct), expected.toString('hex'))
  const pt = aesCbcDecrypt(new Uint8Array(key), new Uint8Array(iv), ct)
  check(`aes dec len${Buffer.byteLength(text)}`, utf8Decode(pt), text)
}
// 解密 node 生成的密文
{
  const key = randomBytes(32)
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  const ct = Buffer.concat([cipher.update(Buffer.from('node-side plaintext', 'utf8')), cipher.final()])
  check('aes dec node', utf8Decode(aesCbcDecrypt(new Uint8Array(key), new Uint8Array(iv), new Uint8Array(ct))), 'node-side plaintext')
}

// ---------- Base32 ----------
check('b32 Hello!', bytesToHex(base32Decode('JBSWY3DPEHPK3PXP')), '48656c6c6f21deadbeef')
check('b32 encode', base32Encode(hexToBytes('48656c6c6f21deadbeef')), 'JBSWY3DPEHPK3PXP')
check('b32 lower/space', bytesToHex(base32Decode('jbsw y3dp ehpk 3pxp')), '48656c6c6f21deadbeef')

// ---------- TOTP RFC 6238 ----------
const RFC_SECRET_SHA1 = base32Encode(utf8('12345678901234567890'))
const RFC_SECRET_SHA256 = base32Encode(utf8('12345678901234567890123456789012'))
const RFC_SECRET_SHA512 = base32Encode(utf8('1234567890123456789012345678901234567890123456789012345678901234'))
const vectors = [
  [59, '94287082', '46119246', '90693936'],
  [1111111109, '07081804', '68084774', '25091201'],
  [1111111111, '14050471', '67062674', '99943326'],
  [1234567890, '89005924', '91819424', '93441116'],
  [2000000000, '69279037', '90698825', '38618901'],
  [20000000000, '65353130', '77737706', '47863826']
]
for (const [t, s1, s256, s512] of vectors) {
  check(`totp sha1 t=${t}`, totpFromSecret(RFC_SECRET_SHA1, { digits: 8, period: 30 }, t * 1000).code, s1)
  check(`totp sha256 t=${t}`, totpFromSecret(RFC_SECRET_SHA256, { digits: 8, algorithm: 'SHA256' }, t * 1000).code, s256)
  check(`totp sha512 t=${t}`, totpFromSecret(RFC_SECRET_SHA512, { digits: 8, algorithm: 'SHA512' }, t * 1000).code, s512)
}

// 剩余秒数
{
  const r = totpFromSecret(RFC_SECRET_SHA1, {}, 59 * 1000)
  check('remaining', r.remaining, 1)
  check('period', r.period, 30)
  check('digits', r.code.length, 6)
}

// ---------- otpauth ----------
{
  const p = parseOtpInput('otpauth://totp/GitHub:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&algorithm=SHA1&digits=6&period=30')
  check('parse issuer', p.issuer, 'GitHub')
  check('parse account', p.account, 'alice@example.com')
  check('parse secret', p.secret, 'JBSWY3DPEHPK3PXP')
  check('parse type', p.type, 'totp')
  const p2 = parseOtpInput('otpauth://totp/ACME%20Co:bob?secret=JBSWY3DPEHPK3PXP&issuer=ACME%20Co')
  check('parse encoded issuer', p2.issuer, 'ACME Co')
  check('parse encoded account', p2.account, 'bob')
  const p3 = parseOtpInput('otpauth://totp/labelonly?secret=JBSWY3DPEHPK3PXP')
  check('parse no issuer', p3.issuer, '')
  const built = buildOtpUri({ issuer: 'GitHub', account: 'alice@example.com', secret: 'JBSWY3DPEHPK3PXP', type: 'totp' })
  // label 按规范做百分号编码（@ -> %40），解析回来仍等价
  check('build uri', built, 'otpauth://totp/GitHub:alice%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub')
  const rt = parseOtpInput(built)
  check('roundtrip issuer', rt.issuer, 'GitHub')
  try {
    parseOtpInput('otpauth://totp/x?secret=BAD1')
    check('invalid secret throws', 'no-throw', 'throw')
  } catch (e) {
    check('invalid secret throws', 'throw', 'throw')
  }
  try {
    parseOtpInput('not a uri')
    check('garbage throws', 'no-throw', 'throw')
  } catch (e) {
    check('garbage throws', 'throw', 'throw')
  }
}

check('format 6', formatCode('123456'), '123 456')
check('format 8', formatCode('12345678'), '1234 5678')
check('verify ok', verify(totpFromSecret('JBSWY3DPEHPK3PXP', {}, Date.now()).code, 'JBSWY3DPEHPK3PXP'), true)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
