# api-mock 浏览器/模拟器桩

aiot-vue-cli 在 web/simulator 构建时会把本目录下每个 `*.js` 注册为**同名虚拟模块**
（文件名开头的 `$jsapi.` 映射为 `$jsapi/`）；设备打包（`-p`）时本目录不参与，
import 交给设备运行时解析真实原生模块。因此同一份代码两端通用。

## 已提供

| 文件 | mock 的模块 | 说明 |
|---|---|---|
| `langningchen.js` | `langningchen` | 社区原生扩展五模块（AI/IME/ScanInput/Shell/Update），AI 含模拟流式输出 |
| `fs.js` | `fs` | 内存文件系统 |
| `wifi.js` | `wifi` | default.Wifi 的只读查询形态；不读取宿主网络或密码 |
| `http.js` | `http` | 浏览器 Fetch；与旧 `$jsapi/http` 分开 |
| `storage.js` | `storage` | 内存 KV 存储 |
| `sqlite3.js` | `sqlite3` | 未内置 SQL 引擎，相关调用明确拒绝 |
| `crypto.js` | `crypto` | 文件 MD5 明确拒绝；Base64 编码复用 SDK 的共享实现 |
| `zip.js` | `zip` | 未实现解压，返回非零 |
| `$am.js` / `am.js` | `$am` / 旧名 `am` | 应用栈 UI stub；本机只确认 `$am` 可导入 |
| `pm.js` | `pm` | 包管理（内存应用表） |
| `updater.js` | `updater` | 受控状态和事件夹具，下载/安装不伪造成功 |
| `$jsapi.storage.js` | `$jsapi/storage` | 框架 jsapi storage |
| `$jsapi.http.js` | `$jsapi/http` | 浏览器 fetch 兜底 |

类型声明见 `@dictpen/types` 的 `system.d.ts` / `langningchen.d.ts`。

## 真实性边界

mock 用于前端开发，不保证完整模拟原生签名、时序、权限和错误行为。文件/KV 位于浏览器内存，不能证明跨进程持久化；SQLite、MD5、ZIP、AMR 安装没有完整浏览器实现。设备校正及未验证项见 SDK 的 `docs/device-audit-2026-10-03.md`。

社区 mock 日志仅保留操作名，省略 API key、提示词、用户文本、命令及仓库配置。系统输入法在浏览器中没有真实实现；模板按钮会明确提示，而不是无限等待假会话。
