#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""真机 UI 辅助：通过 adb + send_event 注入触摸，并抓取屏幕。

用法：
    python tools/ui.py shot index            # 截图到 shots/index.png
    python tools/ui.py tap 790 27 [name]     # 点击后截图
    python tools/ui.py run "cmd"             # 在设备上执行命令
    python tools/ui.py start [page]          # 启动应用（默认 index）
"""
import os
import subprocess
import sys

SERIAL = os.environ.get("PEN_SERIAL", "MEC1700009003678")
APPID = "8002026102300011"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, "shots")


def adb(*args, check=False):
    p = subprocess.run(["adb", "-s", SERIAL] + list(args),
                       capture_output=True, text=True, timeout=120)
    if check and p.returncode != 0:
        raise RuntimeError(p.stderr or p.stdout)
    return p.stdout + p.stderr


def shell(cmd):
    # 远端路径不能过 Git Bash 的路径转换，用 -- 之前已由 subprocess 直接传参，安全
    return adb("shell", cmd)


def shot(name):
    os.makedirs(SHOTS, exist_ok=True)
    remote = "/tmp/uishot.png"
    out = shell("miniapp_cli capture %s" % remote)
    if '"ret": 0' not in out:
        print("capture failed:", out.strip()[:200])
    local = os.path.join(SHOTS, name if name.endswith(".png") else name + ".png")
    adb("pull", remote, local)
    print("saved", local, os.path.getsize(local), "bytes")
    return local


def tap(x, y, name=None, delay=1.2):
    shell("send_event touch press %d %d >/dev/null 2>&1" % (x, y))
    shell("send_event touch release %d %d >/dev/null 2>&1" % (x, y))
    import time
    time.sleep(delay)
    if name:
        shot(name)


def start(page="index"):
    print(shell("setsid miniapp_cli start %s %s > /tmp/ui_start.log 2>&1 < /dev/null & "
                "sleep 5; cat /tmp/ui_start.log" % (APPID, page)))


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    action = sys.argv[1]
    if action == "shot":
        shot(sys.argv[2] if len(sys.argv) > 2 else "shot")
    elif action == "tap":
        x, y = int(sys.argv[2]), int(sys.argv[3])
        tap(x, y, sys.argv[4] if len(sys.argv) > 4 else "tap_%d_%d" % (x, y))
    elif action == "run":
        print(shell(sys.argv[2]))
    elif action == "start":
        start(sys.argv[2] if len(sys.argv) > 2 else "index")
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
