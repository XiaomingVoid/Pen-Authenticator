// 相机取景与解码帧通道：走 /dev/video29（X7P 的彩色摄像头，ISP 主通路之一）
//
// 关键约束（都是真机实测踩出来的）：
// 1. `global.execShell` 是**同步阻塞**的：一次 ffmpeg 调用就把 JS 主线程按住 4 秒，
//    被系统看门狗记成 "Msg process take too many time"。所以帧循环里一个 execShell 都不能有。
// 2. 因此所有重活都放进一个常驻 shell 脚本：gst 出帧 + base64，JS 只用 fs 读文件（异步、毫秒级）。
// 3. **循环里不能调 ffmpeg**：实测这个固件的 ffmpeg 单次调用（288x288 gray→monow）要 3.5 秒，
//    灰度帧早就被 multifilesink 的 max-files 删掉了，每次必败还白烧 3.5 秒 CPU（负载打到 8+，
//    整个系统卡死）。所以二值化（Otsu）放 JS 里做，shell 只 base64（~50ms）。
// 4. 预览要 24fps：让 gst 按传感器帧率直接写 JPEG（实测 640x360@30 能出 ~28fps），
//    JS 每 33ms 把最新帧号绑到 image 上；解码另走一条 2fps 的灰度通道
//    （实测 3fps 时 236ms 的解码计算会把预览挤到 22fps，降到 2fps 后稳定 24fps+）。
//
// 数据流：
//   v4l2src 640x360@30 ┬ queue → videoscale 448x248 → jpegenc → p_%06d.jpg （预览，跟满传感器帧率）
//                      └ queue → videoconvert GRAY8 → videocrop 288x288
//                              → videorate 2fps → g_%06d.gray             （解码）
//   shell 循环：g_*.gray → base64 → q.b64（mv 原子替换）→ q.seq（帧号握手）
//   JS 解码循环：q.b64 → base64ToBytes → Otsu 二值化 → 1-bit → 自研解码器
//
// 停止机制：JS 写 /tmp/authcam.stop（目录外），脚本循环检查同一个路径。
// 注意标记必须在目录外——脚本启动时会 rm -rf 整个目录，放里面会被自己清掉；
// 而放外面时，JS 启动新管道前会 rm -f 旧标记，不会误停新管道。

export const CAM_DIR = '/tmp/authcam'
export const PREVIEW_W = 640
export const PREVIEW_H = 360
// 预览 JPEG 尺寸：比取景 640x360 小一半，原生解码/上传更快（24fps 的关键之一）
export const SHOW_W = 448
export const SHOW_H = 248
export const DECODE_W = 288
export const DECODE_H = 288
export const DECODE_FPS = 2

/** 常驻取景脚本：gst 出帧 + 把灰度帧转成 1-bit base64 */
export const FEED_SCRIPT = [
    '#!/bin/sh',
    'D=__DIR__',
    // 先清掉可能残留的 gst（进程在脚本里杀，不占用 JS 主线程）
    'pkill -9 -f "gst-launch.*video[2]9" 2>/dev/null',
    'rm -rf $D',
    'mkdir -p $D',
    // ---------------- gst 双通道 ----------------
    'gst-launch-1.0 -q v4l2src device=/dev/video29 ! video/x-raw,format=NV12,width=__PW__,height=__PH__,framerate=30/1 ! tee name=t \\',
    // 预览分支不加 videorate：实测 videorate 24/1 反而只出 22fps，直通能到 ~28fps。
    // max-files=16：给渲染器 ~530ms 的文件存活窗口。设 4 时（133ms）渲染器一慢就读到
    // 已删除的文件，框架的失败重试会把消息循环堵住近 3 秒（实测看门狗 2.8s）。
    '  t. ! queue leaky=downstream max-size-buffers=1 ! videoscale ! video/x-raw,width=__SW__,height=__SH__ ! jpegenc quality=50 ! multifilesink location=$D/p_%06d.jpg max-files=16 \\',
    // 灰度分支 max-files=4：base64 一次约 50ms，4 帧（1.3s）存活窗口足够宽，
    // 不会重演 ffmpeg 版「文件在转换前就被删」的竞争。
    '  t. ! queue leaky=downstream max-size-buffers=1 ! videoconvert ! video/x-raw,format=GRAY8 ! videocrop left=__CX__ right=__CX__ top=__CY__ bottom=__CY__ ! videorate ! video/x-raw,framerate=__DF__/1 ! multifilesink location=$D/g_%06d.gray max-files=4 &',
    'echo $! > $D/pid',
    'GP=$!',
    // ---------------- 灰度 → base64（二值化在 JS 侧做） ----------------
    'n=1',
    'while [ ! -f $D.stop ]; do',
    // 自己的 gst 死了（被硬杀/重启）就退出，别留孤儿循环空转
    '  kill -0 $GP 2>/dev/null || break',
    '  f=$(printf "$D/g_%06d.gray" $n)',
    '  if [ -f "$f" ]; then',
    '    base64 -w0 "$f" > $D/q.tmp 2>/dev/null && mv -f $D/q.tmp $D/q.b64',
    '    echo $n > $D/q.tmp && mv -f $D/q.tmp $D/q.seq',
    '    rm -f "$f"',
    '    n=$((n+1))',
    '  else',
    '    sleep 0.04',
    '  fi',
    'done',
    'pkill -9 -f "gst-launch.*video[2]9" 2>/dev/null',
    'rm -f $D/pid $D.stop',
].join('\n')

export function feedScriptBody(dir) {
    return FEED_SCRIPT
        .split('__DIR__').join(dir)
        .split('__PW__').join(String(PREVIEW_W))
        .split('__PH__').join(String(PREVIEW_H))
        .split('__SW__').join(String(SHOW_W))
        .split('__SH__').join(String(SHOW_H))
        .split('__DW__').join(String(DECODE_W))
        .split('__DH__').join(String(DECODE_H))
        .split('__DF__').join(String(DECODE_FPS))
        // 纯裁剪不缩放：videoscale 在本固件不支持 GRAY8 输出
        .split('__CX__').join(String(Math.round((PREVIEW_W - DECODE_W) / 2)))
        .split('__CY__').join(String(Math.round((PREVIEW_H - DECODE_H) / 2)))
}

export function feedScriptPath() {
    return '/tmp/authfeed.sh'
}

/**
 * 停止取景：只写一个 stop 标记，常驻脚本读到后会自己退出并 pkill gst。
 * 不要在这里直接 pkill —— 实测这条 execShell 会同步阻塞 1.5 秒，退出页面时明显卡一下。
 */
export function stopFeedCmd(dir) {
    return 'touch ' + dir + '.stop'
}

export function pad6(n) {
    const s = String(n)
    return s.length >= 6 ? s : '000000'.slice(s.length) + s
}
