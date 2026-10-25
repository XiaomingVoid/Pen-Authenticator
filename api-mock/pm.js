/**
 * pm 模块浏览器 stub：无 AMR 安装器，不伪造已安装应用。
 * 机制见 api-mock/langningchen.js 头注释。
 */

const _packages = new Map()

export default {
  // Captured on firmware 4.9.9 / Falcon 1.6.3, results/pm.json.
  SUCCESS: 0,
  INS_ERROR_FILE_NOT_EXIST: 1,
  INS_ERROR_FAILED_INVALID_AMR: 2,
  RM_ERROR_NOT_EXIST: 50,
  RM_ERROR_NOT_ALLOWED: 51,
  FLAG_SYSTEM_APP: 1,
  FLAG_INVISIBLE: 8192,
  installPackage(path, callback) {
    // Unprivileged probe was denied before file validation. No browser install.
    console.warn(`[mock] pm.installPackage(${path}): permission-denied fixture`)
    if (callback) callback({ msg: 'Permission denied.', res: 100 })
  },
  removePackage(appId, callback) {
    console.log(`[mock] pm.removePackage(${appId})`)
    const removed = _packages.delete(appId)
    if (callback) callback({ res: removed ? this.SUCCESS : this.RM_ERROR_NOT_EXIST })
  },
  getPackageInfo(appId) {
    return _packages.get(appId)
  },
  getInstalledPackages() {
    return [..._packages.values()]
  },
  on(event, callback) {
    console.log(`[mock] pm.on(${event}) 已注册`)
    return `${event}_${Date.now()}`
  },
  off(token) {
    console.log(`[mock] pm.off(${token})`)
  }
}
