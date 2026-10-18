#!/bin/bash
# 悟空Ai 前端上线脚本：备份 -> 拉取新界面 -> 在临时目录编译 -> 编译成功才替换网站
set -e
WEB=/opt/new-api/web
BK=/opt/new-api/backups
TS=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BK"

echo "[1/5] 备份当前网站文件 ..."
tar czf "$BK/web-src-$TS.tgz" -C "$WEB" src public
tar czf "$BK/web-dist-$TS.tgz" -C "$WEB" dist
echo "$TS" > "$BK/LAST_UI_BACKUP"

echo "[2/5] 拉取新界面代码 ..."
rm -rf /tmp/wkui
git clone -q --depth 1 -b ui-redesign https://github.com/168889968-del/wukongai-web /tmp/wkui

echo "[3/5] 准备编译目录 ..."
rm -rf /tmp/wkbuild
cp -a "$WEB" /tmp/wkbuild
rm -rf /tmp/wkbuild/src /tmp/wkbuild/public /tmp/wkbuild/dist /tmp/wkbuild/node_modules
cp -a /tmp/wkui/web/src /tmp/wkbuild/src
cp -a /tmp/wkui/web/public /tmp/wkbuild/public

# 编译很吃内存：临时加 4GB 虚拟内存，脚本结束时自动删除
SWAPF=/wk-build-swap
cleanup_swap() { swapoff "$SWAPF" 2>/dev/null || true; rm -f "$SWAPF"; }
trap cleanup_swap EXIT
cleanup_swap
fallocate -l 4G "$SWAPF" || dd if=/dev/zero of="$SWAPF" bs=1M count=4096 status=none
chmod 600 "$SWAPF"
mkswap "$SWAPF" >/dev/null
swapon "$SWAPF"
free -h | head -3

echo "[4/5] 安装依赖并编译，需要 10 到 20 分钟，看到 built in 就是编译完了，请耐心等待 ..."
docker run --rm -e NODE_ENV=development -v /tmp/wkbuild:/app -w /app oven/bun:1 sh -c "(bun install --frozen-lockfile || bun install) && NODE_ENV=production bun run build" 2>&1 | tee /tmp/wkbuild.log | grep --line-buffered -E "installed|Rsbuild|build started|built in|error" ; test "${PIPESTATUS[0]}" -eq 0 || {
  echo
  tail -n 40 /tmp/wkbuild.log
  echo
  echo "===== 编译失败，网站没有任何改动 BUILD_FAILED ====="
  exit 1
}
test -f /tmp/wkbuild/dist/index.html

echo "[5/5] 替换网站文件 ..."
find "$WEB/dist" -mindepth 1 -delete
cp -a /tmp/wkbuild/dist/. "$WEB/dist/"
rm -rf "$WEB/src" "$WEB/public"
cp -a /tmp/wkbuild/src "$WEB/src"
cp -a /tmp/wkbuild/public "$WEB/public"

echo
echo "===== DEPLOY_OK 上线成功（备份编号 $TS）====="
