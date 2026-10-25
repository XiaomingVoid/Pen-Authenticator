/**
 * updater 模块浏览器 mock：恒返回"已是最新版本"。
 * 机制见 api-mock/langningchen.js 头注释。
 */

const listeners = { ready: new Set(), updateInfo: new Set() }

export default {
  // Captured on firmware 4.9.9 / Falcon 1.6.3, results/updater.json.
  // 检查状态
  ST_UP_TO_DATE: 10, ST_CHECK_PENDING: 1, ST_HAS_NEW_VERSION: 11,
  ST_DOWNLOADING: 2, ST_DOWNLOAD_DONE: 20, ST_INSTALLING: 30, ST_DOWNLOAD_PAUSED: 21,
  // 下载结果
  DL_ERROR: -1, DL_ABORTED: -1, DL_SUCCESS: 0, DL_ERROR_ON_GOING: -2, DL_PAUSED: -3,
  // 下载原因
  DL_REASON_ABORT_INIT_ERROR: -299, DL_REASON_ABORT_URL_INACCESSIBLE: -298,
  DL_REASON_ABORT_MD5_MISMATCH: -297, DL_REASON_ABORT_UNKNOWN: -296,
  DL_REASON_PAUSE_NETWORK_BROKEN: -199, DL_REASON_PAUSE_INSUFFICIENT_SPACE: -198,
  DL_REASON_PAUSE_IO_EXCEPTION: -197, DL_REASON_PAUSE_UNKNOWN: -196,
  // 安装结果
  INS_ERROR_INSTALLATION: -4, INS_ERROR_NO_INSTALL_PACKAGE: -3,
  INS_ERROR_INSTALL_ALREADY_ON_GOING: -2, INS_ERROR_NO_UPDATE_INFO: -1, INS_SUCCESS: 0,
  // 全局事件
  EVT_UPDATE_CHECK_PENDING: 101, EVT_UPDATE_CHECK_ERROR: 102, EVT_GOT_ALREADY_UP_TO_DATE: 103,
  EVT_GOT_NEW_VERSION: 104, EVT_DOWNLOAD_PENDING: 105, EVT_DOWNLOAD_PERCENT_CHANGE: 106,
  EVT_DOWNLOAD_ERROR: 107, EVT_DOWNLOAD_DONE: 108, EVT_INSTALLING: 109,
  EVT_INSTALL_SUCCESS: 110, EVT_INSTALL_ERROR: 111, EVT_DOWNLOAD_PAUSED: 112,

  getUpdateInfo(appid, callback) {
    console.log(`[mock] updater.getUpdateInfo(${appid})`)
    if (callback) {
      setTimeout(() => callback({ appid, downloadPercent: -1, installFile: '', reason: 0, state: this.ST_UP_TO_DATE }), 200)
    }
  },
  startDownload(appid, callback) {
    console.log(`[mock] updater.startDownload(${appid})`)
    if (callback) callback({ result: this.DL_ERROR, reason: this.DL_REASON_ABORT_URL_INACCESSIBLE })
  },
  installUpdate(appid, callback) {
    console.log(`[mock] updater.installUpdate(${appid})`)
    if (callback) callback({ result: this.INS_ERROR_NO_INSTALL_PACKAGE })
  },
  on(event, callback) {
    console.log(`[mock] updater.on(${event}) 已注册`)
    // Firmware 4.9.9 / Falcon 1.6.3: no callback within the 500ms probe window.
    // This does not establish behavior beyond that window.
    if (listeners[event]) listeners[event].add(callback)
  },
  // Browser-only explicit delivery; not an assertion about native event timing.
  _emit(event, ...args) {
    for (const callback of listeners[event] || []) callback(...args)
  },
  isReady() { return true }
}
