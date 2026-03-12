#!/bin/bash

echo "Upgrade Vito to FrankenPHP"
echo "=========================="

VITO_DIR="/home/vito/vito"
VITO_PORT="${VITO_PORT:-54331}"

if [[ ! -d "${VITO_DIR}" ]]; then
  echo "Error: Vito installation not found at ${VITO_DIR}"
  exit 1
fi

cd "${VITO_DIR}"

# 1. Download FrankenPHP binary
echo "Downloading FrankenPHP..."
mkdir -p /home/vito/bin
ARCH=$(dpkg --print-architecture)
curl -L -o /home/vito/bin/frankenphp \
  "https://github.com/dunglas/frankenphp/releases/latest/download/frankenphp-linux-${ARCH}"
chmod +x /home/vito/bin/frankenphp
chown vito:vito /home/vito/bin/frankenphp
setcap cap_net_bind_service=+ep /home/vito/bin/frankenphp

# 2. Update .env
echo "Updating .env..."
update_env() {
  local key=$1
  local value=$2
  if grep -q "^${key}=" "${VITO_DIR}/.env"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "${VITO_DIR}/.env"
  else
    echo "${key}=${value}" >> "${VITO_DIR}/.env"
  fi
}

update_env "VITO_MODE" "local"
update_env "VITO_PORT" "${VITO_PORT}"
update_env "VITO_SSL" "false"

# Update APP_URL to use new port
CURRENT_URL=$(grep "^APP_URL=" "${VITO_DIR}/.env" | cut -d= -f2-)
if [[ -n "${CURRENT_URL}" ]]; then
  # Remove any existing port from URL
  BASE_URL=$(echo "${CURRENT_URL}" | sed 's|:[0-9]*$||')
  update_env "APP_URL" "${BASE_URL}:${VITO_PORT}"
fi

# 3. Generate Caddyfile
echo "Generating Caddyfile..."
/home/vito/bin/frankenphp php-cli artisan vito:generate-caddyfile

# 4. Create octane supervisor config
echo "Setting up supervisor configs..."
mkdir -p /home/vito/.logs/workers

cat > /etc/supervisor/conf.d/octane.conf << 'SUPERVISOREOF'
[program:octane]
process_name=%(program_name)s
command=/home/vito/bin/frankenphp run --config /home/vito/vito/Caddyfile
directory=/home/vito/vito
autostart=1
autorestart=1
user=vito
redirect_stderr=true
stdout_logfile=/home/vito/.logs/workers/octane.log
stopwaitsecs=10
SUPERVISOREOF

touch /home/vito/.logs/workers/octane.log

# 5. Update worker supervisor config to use FrankenPHP
cat > /etc/supervisor/conf.d/worker.conf << 'SUPERVISOREOF'
[program:worker]
process_name=%(program_name)s_%(process_num)02d
command=/home/vito/bin/frankenphp php-cli /home/vito/vito/artisan horizon
autostart=1
autorestart=1
user=vito
redirect_stderr=true
stdout_logfile=/home/vito/.logs/workers/worker.log
stopwaitsecs=3600
SUPERVISOREOF

# 6. Update websocket supervisor config to use FrankenPHP
cat > /etc/supervisor/conf.d/websocket.conf << 'SUPERVISOREOF'
[program:websocket]
process_name=%(program_name)s
command=/home/vito/bin/frankenphp php-cli /home/vito/vito/artisan ws:serve
autostart=1
autorestart=1
user=vito
redirect_stderr=true
stdout_logfile=/home/vito/.logs/workers/websocket.log
SUPERVISOREOF

# 7. Remove Vito's nginx vhost (keep nginx for user sites)
echo "Removing Vito nginx vhost..."
rm -f /etc/nginx/sites-enabled/vito
rm -f /etc/nginx/sites-available/vito
service nginx reload 2>/dev/null || true

# 8. Update crontab to use FrankenPHP binary
echo "Updating crontab..."
echo "* * * * * cd /home/vito/vito && /home/vito/bin/frankenphp php-cli artisan schedule:run >> /dev/null 2>&1" | sudo -u vito crontab -

# 9. Reload supervisor and start processes
echo "Starting FrankenPHP..."
supervisorctl reread
supervisorctl update
supervisorctl restart octane 2>/dev/null || supervisorctl start octane
supervisorctl restart worker:*
supervisorctl restart websocket 2>/dev/null || true

# 10. Allow port in firewall
echo "Updating firewall..."
ufw allow ${VITO_PORT}/tcp 2>/dev/null || true

# 11. Add app SSH public key to authorized_keys (if not already)
if [[ -f "${VITO_DIR}/storage/ssh-public.key" ]]; then
  APP_PUB_KEY=$(cat "${VITO_DIR}/storage/ssh-public.key")
  if ! grep -qF "${APP_PUB_KEY}" /home/vito/.ssh/authorized_keys 2>/dev/null; then
    cat "${VITO_DIR}/storage/ssh-public.key" >> /home/vito/.ssh/authorized_keys
    chown vito:vito /home/vito/.ssh/authorized_keys
    chmod 600 /home/vito/.ssh/authorized_keys
  fi
fi

# 12. Run setup-local command (idempotent)
echo "Setting up local server..."
/home/vito/bin/frankenphp php-cli artisan server:setup-local

# 13. Fix ownership
chown -R vito:vito /home/vito/.logs
chown -R vito:vito /home/vito/bin

echo ""
echo "✅ Vito has been upgraded to FrankenPHP!"
echo "✅ Accessible at: $(grep "^APP_URL=" "${VITO_DIR}/.env" | cut -d= -f2-)"
echo "✅ Nginx is still available for user-managed sites"
