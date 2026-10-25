#!/usr/bin/env python
"""词典笔部署/调试辅助。

用法:
  device.py upload <local> <remote>     # remote 可写 userdisk/Favorite/x.amr（自动补 /，规避 Git Bash 路径转换）
  device.py download <remote> <local>
  device.py run <cmd>
  device.py tail [n]
  device.py logsize
  device.py since <offset>

注意: Git Bash 会把 / 开头的参数转换成 Windows 路径, 所以远端路径一律用不带前导斜杠的形式。
"""
import sys
import paramiko

HOST = "192.168.1.192"
USER = "root"
PWD = "Fontaine182376"


def remote_path(p):
    p = p.replace("\\", "/")
    # 兼容被 MSYS 转换过的路径: C:/Program Files/Git/userdisk/... -> /userdisk/...
    idx = p.find("/userdisk")
    if idx < 0:
        idx = p.find("/userdata")
    if idx >= 0:
        return p[idx:]
    if not p.startswith("/"):
        return "/" + p
    return p


def client():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, username=USER, password=PWD, timeout=15, banner_timeout=20)
    return c


def main():
    action = sys.argv[1]
    c = client()
    if action == "upload":
        local, remote = sys.argv[2], remote_path(sys.argv[3])
        with c.open_sftp() as sftp, open(local, "rb") as fh:
            sftp.putfo(fh, remote)
        print(f"uploaded {local} -> {remote}")
    elif action == "download":
        remote, local = remote_path(sys.argv[2]), sys.argv[3]
        with c.open_sftp() as sftp, open(local, "wb") as fh:
            sftp.getfo(remote, fh)
        print(f"downloaded {remote} -> {local}")
    elif action == "run":
        _, stdout, stderr = c.exec_command(sys.argv[2], timeout=180)
        sys.stdout.write(stdout.read().decode("utf-8", "replace"))
        err = stderr.read().decode("utf-8", "replace")
        if err:
            sys.stderr.write("[stderr] " + err)
        print(f"[exit={stdout.channel.recv_exit_status()}]")
    elif action == "logpath":
        _, stdout, _ = c.exec_command("readlink /proc/$(pidof miniapp)/fd/1")
        print(stdout.read().decode().strip())
    elif action == "tail":
        n = sys.argv[2] if len(sys.argv) > 2 else "80"
        cmd = f"f=$(readlink /proc/$(pidof miniapp)/fd/1); tail -n {n} $f"
        _, stdout, _ = c.exec_command(cmd, timeout=60)
        sys.stdout.write(stdout.read().decode("utf-8", "replace"))
    elif action == "since":
        offset = sys.argv[2]
        cmd = f"f=$(readlink /proc/$(pidof miniapp)/fd/1); tail -c +{int(offset) + 1} $f"
        _, stdout, _ = c.exec_command(cmd, timeout=60)
        sys.stdout.write(stdout.read().decode("utf-8", "replace"))
    elif action == "logsize":
        cmd = "f=$(readlink /proc/$(pidof miniapp)/fd/1); wc -c < $f"
        _, stdout, _ = c.exec_command(cmd)
        print(stdout.read().decode().strip())
    c.close()


if __name__ == "__main__":
    main()
