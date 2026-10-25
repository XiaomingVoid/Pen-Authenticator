/**
 * $jsapi/storage 浏览器 mock。
 *
 * 机制：aiot-vue-cli 将 api-mock/$jsapi.storage.js 注册为虚拟模块 $jsapi/storage
 * （文件名开头的 "$jsapi." 会被替换为 "$jsapi/"），供 falcon-ui 框架内部或
 * 自行 import '$jsapi/storage' 时在 web/simulator 构建中使用。
 * 设备构建不生效，走运行时真实 jsapi。
 */

const _store = new Map()

export default {
  setStorage({ key, data }) {
    _store.set(key, String(data))
    return Promise.resolve({ [key]: String(data) })
  },
  getStorage({ key }) {
    return Promise.resolve(_store.has(key) ? { data: _store.get(key) } : { error: 3, errorMessage: 'get storage failed!' })
  },
  removeStorage({ key }) {
    _store.delete(key)
    return Promise.resolve({ [key]: 'removed' })
  },
  clearStorage() {
    _store.clear()
    return Promise.resolve({ mock: 'cleared' })
  },
  getStorageInfo() {
    // Firmware 4.9.9 / Falcon 1.6.3: observed one-key snapshot is '1' / '0'.
    // Entry count is a browser approximation, not a verified native size unit.
    return Promise.resolve({ keys: [..._store.keys()], currentSize: String(_store.size), limitSize: '0' })
  }
}
