#!/bin/bash
# 修复：把已有数据库的密码改成当前配置里的密码（不删除任何数据），然后重启后端
set -e
APP=/opt/new-api
. "$APP/.wukongai-secrets"
cd "$APP"
docker compose up -d postgres redis >/dev/null
sleep 3
SQL="ALTER USER root WITH PASSWORD '$PG_PASS';"
docker exec postgres psql -U root -d postgres -c "$SQL" 2>/dev/null \
  || docker exec postgres psql -U postgres -d postgres -c "CREATE USER root WITH SUPERUSER PASSWORD '$PG_PASS';" 2>/dev/null \
  || docker exec postgres psql -U postgres -d postgres -c "ALTER USER root WITH PASSWORD '$PG_PASS';"
docker exec postgres psql -U root -d postgres -tc "SELECT 1 FROM pg_database WHERE datname='new-api'" | grep -q 1 \
  || docker exec postgres psql -U root -d postgres -c 'CREATE DATABASE "new-api";'
docker compose up -d
docker compose restart new-api >/dev/null
echo "检查服务状态（约 30 秒）..."
for i in $(seq 1 30); do
  if curl -fs http://127.0.0.1:3000/api/status | grep -q success; then break; fi
  sleep 2
done
docker compose ps --format "table {{.Name}}\t{{.Status}}"
curl -fs http://127.0.0.1:3000/api/status | grep -q success || {
  docker compose logs --tail 20 new-api
  echo
  echo "===== 后端仍未正常启动 START_FAILED ====="
  exit 1
}
echo
echo "本机公网 IP：$(curl -fs https://api.ipify.org || echo 未知)"
echo "===== DEPLOY_OK 部署完成，请访问 https://wukongai.work ====="
