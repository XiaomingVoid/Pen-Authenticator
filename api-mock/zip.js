/**
 * zip 模块浏览器 stub：未实现解压，返回非零失败码。
 * 机制见 api-mock/langningchen.js 头注释。
 */

class MockZipFile {
  constructor(path) {
    this._path = path
  }
  async extractall(outPath) {
    console.warn(`[mock] zip.ZipFile(${this._path}).extractall(${outPath}): unsupported in browser`)
    // Browser-only failure value; not a native error-code assignment.
    return -1
  }
}

export default {
  ZIP_STORED: 1,
  ZIP_DEFLATED: 2,
  ZIP_BZIP2: 3,
  ZIP_LZMA: 4,
  ZipFile: MockZipFile
}
