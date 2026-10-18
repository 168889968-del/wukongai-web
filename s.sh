#!/bin/bash
# 把服务器上的网站前端源码同步到 GitHub 仓库的 server-snapshot 分支（只读复制，不改动网站）
set -e
export GIT_SSH_COMMAND="ssh -i /root/.ssh/wkdeploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
rm -rf /tmp/wksnap && mkdir -p /tmp/wksnap/web && cd /tmp/wksnap
git init -q -b server-snapshot
cp -a /opt/new-api/web/src /opt/new-api/web/public /opt/new-api/web/package.json web/
cp -a /opt/new-api/web/bun.lock web/ 2>/dev/null || true
git -C /opt/new-api rev-parse HEAD > UPSTREAM_COMMIT
git -C /opt/new-api status --short > SERVER_STATUS
git add -A
git -c user.name=wukongai-server -c user.email=server@wukongai.work commit -q -m "server snapshot"
git push -q -f git@github.com:168889968-del/wukongai-web.git server-snapshot
echo
echo "===== SNAPSHOT_OK 同步成功 ====="
