#!/usr/bin/env python
"""运行指定页面并抓取本次新增日志: python probe.py <page> [seconds] [filter]"""
import sys
import time
import paramiko

HOST, USER, PWD = "192.168.1.192", "root", "Fontaine182376"
APPID = "8002026102300011"


def main():
    page = sys.argv[1]
    wait = float(sys.argv[2]) if len(sys.argv) > 2 else 6.0
    pattern = sys.argv[3] if len(sys.argv) > 3 else "PROBE"
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PWD, timeout=15, banner_timeout=20)

    def sh(cmd, timeout=60):
        _, out, _ = c.exec_command(cmd, timeout=timeout)
        return out.read().decode("utf-8", "replace")

    log = sh("readlink /proc/$(pidof miniapp)/fd/1").strip()
    offset = int(sh(f"wc -c < {log}").strip() or 0)

    # 后台启动，避免 CLI 偶发阻塞把整个探针拖死
    sh(f"(miniapp_cli start {APPID} {page} > /tmp/probe_start.log 2>&1 &) ; sleep 2; cat /tmp/probe_start.log")

    time.sleep(wait)
    text = sh(f"tail -c +{offset + 1} {log} | grep -a '{pattern}'")
    print(text)
    errors = sh(
        f"tail -c +{offset + 1} {log} | grep -aE 'could not load module|could not find|ReferenceError|TypeError|SyntaxError|Exception|crash|FATAL' | head -20"
    )
    print("---- errors ----")
    print(errors)
    c.close()


if __name__ == "__main__":
    main()
