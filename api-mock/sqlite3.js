/**
 * sqlite3 模块浏览器 stub：未绑定 SQL 引擎，操作明确拒绝。
 * 不模拟写入成功或持久化；真实查询逻辑请以设备为准。
 * 机制见 api-mock/langningchen.js 头注释。
 */

function unsupported(method) {
  throw new Error(`[mock] sqlite3.${method}: unsupported in browser; no SQL engine is configured`)
}

class MockDatabase {
  constructor() {
    this.path = ''
  }
  async open(_path) {
    unsupported('open')
  }
  async close() { return 'CLOSED' }
  async exec(_sql) {
    unsupported('exec')
  }
  async prepare(_sql) {
    unsupported('prepare')
  }
}

export default {
  Database: MockDatabase
}
