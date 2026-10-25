// 生成 SHA-1/SHA-256/SHA-512 常量表（避免手抄出错），输出可直接粘贴到 lib/hash.js
function primes(n) {
  const out = []
  for (let i = 2; out.length < n; i++) {
    let ok = true
    for (let d = 2; d * d <= i; d++) if (i % d === 0) { ok = false; break }
    if (ok) out.push(i)
  }
  return out
}

// 精确求 floor(p^(1/k) * 2^bits)
function rootScaled(p, k, bits) {
  const target = BigInt(p) << BigInt(k * bits)
  let lo = 0n
  let hi = 1n << BigInt(bits + 8)
  while (lo < hi) {
    const mid = (lo + hi + 1n) >> 1n
    if (mid ** BigInt(k) <= target) lo = mid
    else hi = mid - 1n
  }
  return lo
}

const P = primes(80)
const fmt = (v, width) => '0x' + v.toString(16).padStart(width, '0')

const k256 = P.slice(0, 64).map(p => Number(rootScaled(p, 3, 32) & 0xffffffffn))
const h256 = P.slice(0, 8).map(p => Number(rootScaled(p, 2, 32) & 0xffffffffn))
const k512 = P.map(p => rootScaled(p, 3, 64) & ((1n << 64n) - 1n))
const h512 = P.slice(0, 8).map(p => rootScaled(p, 2, 64) & ((1n << 64n) - 1n))

console.log('// 校验: sha256 K[0] 应为 428a2f98, H[0] 应为 6a09e667')
console.log('K256=' + JSON.stringify(k256.map(v => Number(v))))
console.log('H256=' + JSON.stringify(h256.map(v => Number(v))))
console.log('K512=' + JSON.stringify(k512.map(v => fmt(v, 16))))
console.log('H512=' + JSON.stringify(h512.map(v => fmt(v, 16))))
