/**
 * global 原生模块的浏览器 mock（供 aiot-vue-cli web/simulator 构建使用）。
 *
 * 机制同 api-mock/langningchen.js 头注释：web/simulator 环境命中本文件，
 * 设备构建（-p 打包）时 api-mock 不参与，import 交给设备端 QuickJS 解析原生模块。
 *
 * 设备端真实能力（反编译自 JSGlobalProxy）：
 *   - startTextEdit(inputType)  启动系统输入法编辑会话（返回任务 uuid）
 *   - textEditFinished 信号     编辑结束回传（双通道：Global 信号 + $falcon 事件）
 *   - isAsrLocalEnabled()       本地语音识别开关（决定输入法语音按钮显隐）
 *   - closeTextEdit()           主动关闭编辑会话
 *   - execShell(cmd)            执行 shell 命令（无回显、异步）
 */

let nextSessionId = 0

class Global {
  constructor() {
    const listeners = new Set()
    this.textEditFinished = {
      on(callback) { listeners.add(callback) },
      off(callback) { listeners.delete(callback) },
      // Browser-only control: deliver raw native-style arguments to subscribers.
      // Example: _emit({ contents: 'edited', editConfirmed: true }).
      _emit(...args) {
        for (const callback of [...listeners]) callback(...args)
      }
    }
  }
  startTextEdit(inputType) {
    console.log('[mock] Global.startTextEdit(' + inputType + ')')
    // Browser-only session token; no native IME is opened. Remain pending until
    // textEditFinished._emit(...) or the caller's close/cancellation workflow.
    return (++nextSessionId).toString(16).padStart(32, '0')
  }
  isAsrLocalEnabled() {
    console.log('[mock] Global.isAsrLocalEnabled() -> false（浏览器无本地语音识别）')
    return false
  }
  closeTextEdit(uuid) {
    if (typeof uuid !== 'string') throw new TypeError('uuid should be string')
    console.log('[mock] Global.closeTextEdit(' + uuid + ')')
  }
  execShell(cmd) {
    console.warn('[mock] Global.execShell(' + cmd + '): unsupported in browser')
    return false
  }
}

export default {
  Global
}
