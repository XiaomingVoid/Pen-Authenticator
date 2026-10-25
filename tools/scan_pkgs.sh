#!/bin/sh
echo "=== 最近安装 ==="
ls -lat /userdisk/secondary/miniapp/data/mini_app/pkg/ | head -8
echo "=== 含 libs 的包 ==="
for d in /userdisk/secondary/miniapp/data/mini_app/pkg/*/; do
  for s in a b; do
    if [ -d "$d$s/libs" ]; then
      echo "$d$s:"
      ls "$d$s/libs" | head -8
    fi
  done
done
echo "=== 各包首个页面文件，用于认名字 ==="
for d in /userdisk/secondary/miniapp/data/mini_app/pkg/*/; do
  for s in a b; do
    if [ -f "$d$s/app.js" ]; then
      echo "--- $d$s"
      head -c 300 "$d$s/app.js" 2>/dev/null
      echo
    fi
  done
done
