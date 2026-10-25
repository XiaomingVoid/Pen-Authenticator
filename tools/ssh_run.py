#!/usr/bin/env python
"""在词典笔上执行 SSH 命令: python ssh_run.py "<cmd>" """
import sys
import paramiko

HOST = "192.168.1.192"
USER = "root"
PWD = "Fontaine182376"


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "uname -a"
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=PWD, timeout=15, banner_timeout=20)
    stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    sys.stdout.write(out)
    if err:
        sys.stderr.write("[stderr] " + err)
    print(f"\n[exit={code}]")
    client.close()


if __name__ == "__main__":
    main()
