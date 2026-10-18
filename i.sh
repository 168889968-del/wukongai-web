#!/bin/bash
# 悟空Ai 全新部署脚本（Ubuntu 22.04）
# 安装 Docker -> 下载 New API -> 套用悟空Ai界面 -> 编译前端 -> 启动数据库/后端/HTTPS
set -e
DOMAIN=wukongai.work
NEWAPI_COMMIT=45fbb149f0c89ff48d805335f22419be392d0350
NEWAPI_IMAGE=calciumion/new-api:v1.0.0-rc.44
APP=/opt/new-api
export DEBIAN_FRONTEND=noninteractive

echo "[1/7] 安装基础工具和 Docker（几分钟）..."
apt-get update -y -qq
apt-get install -y -qq git curl ca-certificates openssl >/dev/null
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh >/dev/null
fi
systemctl enable --now docker >/dev/null 2>&1 || true
docker compose version >/dev/null 2>&1 || apt-get install -y -qq docker-compose-plugin >/dev/null
docker --version

echo "[2/7] 下载 New API 源码 ..."
if [ ! -d "$APP/.git" ]; then
  git clone -q --filter=blob:none --no-checkout https://github.com/QuantumNous/new-api "$APP"
fi
git -C "$APP" checkout -q "$NEWAPI_COMMIT"

echo "[3/7] 套用悟空Ai界面 ..."
rm -rf /tmp/wkui
git clone -q --depth 1 -b ui-redesign https://github.com/168889968-del/wukongai-web /tmp/wkui
rm -rf "$APP/web/src" "$APP/web/public" "$APP/web/dist" "$APP/web/node_modules"
cp -a /tmp/wkui/web/src "$APP/web/src"
cp -a /tmp/wkui/web/public "$APP/web/public"
mkdir -p "$APP/web/dist" "$APP/backups"

echo "[4/7] 编译前端（装依赖加编译，约 5 到 10 分钟，屏幕不动是正常的）..."
SWAPF=/wk-build-swap
cleanup_swap() { swapoff "$SWAPF" 2>/dev/null || true; rm -f "$SWAPF"; }
trap cleanup_swap EXIT
cleanup_swap
fallocate -l 4G "$SWAPF" || dd if=/dev/zero of="$SWAPF" bs=1M count=4096 status=none
chmod 600 "$SWAPF"
mkswap "$SWAPF" >/dev/null
swapon "$SWAPF"
docker run --rm -e NODE_ENV=development -v "$APP/web":/app -w /app oven/bun:1 \
  sh -c "bun install --frozen-lockfile || bun install; bun run build" > /tmp/wkbuild.log 2>&1 || {
  tail -n 40 /tmp/wkbuild.log
  echo
  echo "===== 前端编译失败 BUILD_FAILED ====="
  exit 1
}
test -f "$APP/web/dist/index.html"
cleanup_swap

echo "[5/7] 生成配置和随机密码 ..."
SECRETS="$APP/.wukongai-secrets"
if [ ! -f "$SECRETS" ]; then
  {
    echo "PG_PASS=$(openssl rand -hex 16)"
    echo "REDIS_PASS=$(openssl rand -hex 16)"
    echo "SESSION_SECRET=$(openssl rand -hex 32)"
  } > "$SECRETS"
  chmod 600 "$SECRETS"
fi
. "$SECRETS"

cat > "$APP/docker-compose.yml" <<EOF
services:
  new-api:
    image: $NEWAPI_IMAGE
    container_name: new-api
    restart: always
    command: --log-dir /app/logs
    ports:
      - "127.0.0.1:3000:3000"
    volumes:
      - ./data:/data
      - ./logs:/app/logs
    environment:
      - SQL_DSN=postgresql://root:$PG_PASS@postgres:5432/new-api
      - REDIS_CONN_STRING=redis://:$REDIS_PASS@redis:6379
      - SESSION_SECRET=$SESSION_SECRET
      - TZ=Asia/Shanghai
      - ERROR_LOG_ENABLED=true
      - BATCH_UPDATE_ENABLED=true
    depends_on:
      - redis
      - postgres
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O - http://localhost:3000/api/status | grep -q success || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7
    container_name: redis
    restart: always
    command: ["redis-server", "--requirepass", "$REDIS_PASS"]

  postgres:
    image: postgres:15
    container_name: postgres
    restart: always
    environment:
      POSTGRES_USER: root
      POSTGRES_PASSWORD: $PG_PASS
      POSTGRES_DB: new-api
    volumes:
      - pg_data:/var/lib/postgresql/data

  caddy:
    image: caddy:2
    container_name: new-api-caddy
    restart: always
    ports:
      - "80:80"
      - "443:443"
      - "443:443/udp"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./web/dist:/srv/wukongai-web:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - new-api

volumes:
  pg_data:
  caddy_data:
  caddy_config:
EOF
chmod 600 "$APP/docker-compose.yml"

cat > "$APP/Caddyfile" <<'EOF'
DOMAIN_PLACEHOLDER {
	encode zstd gzip
	root * /srv/wukongai-web

	@frontend_file file {path}
	@web_page {
		method GET
		header Accept *text/html*
		not path /api* /v1* /v1beta* /pg* /mj* /dashboard/billing*
	}

	route {
		handle @frontend_file {
			file_server
		}
		handle / {
			rewrite * /index.html
			file_server
		}
		handle @web_page {
			rewrite * /index.html
			file_server
		}
		handle {
			reverse_proxy new-api:3000
		}
	}
}
EOF
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/" "$APP/Caddyfile"

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443 >/dev/null
fi

echo "[6/7] 启动数据库、后端和 HTTPS ..."
cd "$APP"
docker compose up -d

echo "[7/7] 检查服务状态（约 30 秒）..."
for i in $(seq 1 30); do
  if curl -fs http://127.0.0.1:3000/api/status | grep -q success; then break; fi
  sleep 2
done
docker compose ps --format "table {{.Name}}\t{{.Status}}"
curl -fs http://127.0.0.1:3000/api/status | grep -q success || {
  docker compose logs --tail 30 new-api
  echo
  echo "===== 后端没有正常启动 START_FAILED ====="
  exit 1
}
echo
echo "本机公网 IP：$(curl -fs https://api.ipify.org || echo 未知)"
echo "===== DEPLOY_OK 部署完成，请访问 https://$DOMAIN ====="
