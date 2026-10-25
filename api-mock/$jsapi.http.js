/**
 * $jsapi/http 浏览器 mock。
 *
 * 机制同 $jsapi.storage.js：web/simulator 构建时注册为虚拟模块 $jsapi/http，
 * 用浏览器 fetch 兜底；设备构建走真实 jsapi。
 */

export default {
  async request({ url, method = 'GET' }) {
    // Verified legacy bridge ignores the formerly declared data/headers/timeout options.
    // This is deliberately not interchangeable with native http.request.
    try {
      const response = await fetch(url, { method: method === 'POST' ? 'POST' : 'GET' })
      if (!response.ok) return { error: 3, result: { errorMessage: 'HTTP status ' + response.status } }
      return { result: await response.text() }
    } catch (error) { return { error: 3, result: { errorMessage: String(error) } } }
  }
}
