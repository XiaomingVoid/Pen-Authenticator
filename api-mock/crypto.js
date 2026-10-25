/**
 * crypto 模块浏览器 stub：无文件哈希实现时明确拒绝，不返回伪 MD5。
 * 机制见 api-mock/langningchen.js 头注释。
 */

import { encodeBase64 } from '@dictpen/core/encoding'

class MockHash {
  constructor(method) {
    if (method !== 'md5') {
      throw new Error(`[mock] crypto.Hash: 暂只支持 md5，收到 ${method}`)
    }
    this._method = method
  }
  async hashFile(path) {
    throw new Error(`[mock] crypto.Hash(${this._method}).hashFile(${path}): unsupported in browser`)
  }
}

export default {
  Hash: MockHash,
  base64Encode: encodeBase64
}
