/**
 * storage 模块浏览器 mock：应用级 KV 存储的内存实现。
 * 机制见 api-mock/langningchen.js 头注释。
 */

const _kv = new Map()

export default {
  async getStorage(key) {
    // Device contract: Falcon 1.6.3 / firmware 4.9.9.
    return _kv.has(key) ? _kv.get(key) : null
  },
  async setStorage(key, value) {
    _kv.set(key, String(value))
    return 0
  },
  async getStorageKeys() {
    return [..._kv.keys()]
  },
  async removeStorage(key) {
    _kv.delete(key)
    return 0
  },
  async clearStorage() {
    _kv.clear()
    return 0
  }
}
