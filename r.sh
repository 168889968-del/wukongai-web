#!/bin/bash
# 悟空Ai 前端恢复脚本：把网站恢复到最近一次上线前的样子
set -e
WEB=/opt/new-api/web
BK=/opt/new-api/backups
TS=$(cat "$BK/LAST_UI_BACKUP")
test -f "$BK/web-dist-$TS.tgz"
find "$WEB/dist" -mindepth 1 -delete
tar xzf "$BK/web-dist-$TS.tgz" -C "$WEB"
rm -rf "$WEB/src" "$WEB/public"
tar xzf "$BK/web-src-$TS.tgz" -C "$WEB"
echo
echo "===== RESTORE_OK 已恢复到备份 $TS ====="
