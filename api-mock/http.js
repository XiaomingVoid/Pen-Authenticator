// Native http uses status/body; legacy $jsapi/http is a different contract.
export default {
  async request({ url, method = 'GET', headers = {}, data, timeout = 10000 }) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)
    try {
      const response = await fetch(url, { method, headers: { ...headers }, signal: controller.signal, ...(data === undefined ? {} : { body: data }) })
      const body = await response.text()
      return { status: response.status, body, headers: Object.fromEntries(response.headers.entries()) }
    } finally { clearTimeout(timer) }
  },
  download() { return Promise.reject(new Error('Native file download is not implemented in the browser mock')) }
}
