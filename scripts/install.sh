#!/bin/bash

echo "
 __      ___ _        _____             _
 \ \    / (_) |      |  __ \           | |
  \ \  / / _| |_ ___ | |  | | ___ _ __ | | ___  _   _
   \ \/ / | | __/ _ \| |  | |/ _ \ '_ \| |/ _ \| | | |
    \  /  | | || (_) | |__| |  __/ |_) | | (_) | |_| |
     \/   |_|\__\___/|_____/ \___| .__/|_|\___/ \__, |
                                 | |             __/ |
                                 |_|            |___/
"

export VITO_VERSION="${VITO_VERSION:-4.x}"
export VITO_CHANNEL="${VITO_CHANNEL:-release}"
export VITO_PORT="${VITO_PORT:-54331}"
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
export HOME="${HOME:-/root}"

if [[ -z "${V_PASSWORD}" ]]; then
  export V_PASSWORD=$(openssl rand -base64 12)
fi

if [[ -z "${VITO_APP_URL}" ]]; then
  export DEFAULT_VITO_APP_URL=http://$(curl -s https://free.freeipapi.com -4):${VITO_PORT}
  read -p "Enter the APP_URL [$DEFAULT_VITO_APP_URL]: " VITO_APP_URL
  export VITO_APP_URL=${VITO_APP_URL:-$DEFAULT_VITO_APP_URL}
  echo "APP_URL is set to: $VITO_APP_URL\n"
fi

if [[ -z "${V_ADMIN_EMAIL}" ]]; then
  read -p "Enter admin's email address: " V_ADMIN_EMAIL
fi

if [[ -z "${V_ADMIN_EMAIL}" ]]; then
  echo "Error: V_ADMIN_EMAIL environment variable is not set."
  exit 1
fi

if [[ -z "${V_ADMIN_PASSWORD}" ]]; then
  read -p "Enter a password for the admin user: " V_ADMIN_PASSWORD
fi

if [[ -z "${V_ADMIN_PASSWORD}" ]]; then
  echo "Error: V_ADMIN_PASSWORD environment variable is not set."
  exit 1
fi

apt remove needrestart -y

useradd -p $(openssl passwd -1 ${V_PASSWORD}) vito
usermod -aG vito
echo "vito ALL=(ALL) NOPASSWD:ALL" | tee -a /etc/sudoers
mkdir /home/vito
mkdir /home/vito/.ssh
chown -R vito:vito /home/vito
chsh -s /bin/bash "vito"
su - "vito" -c "ssh-keygen -t rsa -N '' -f ~/.ssh/id_rsa" <<< y

# upgrade
apt clean
apt update
apt upgrade -y
apt autoremove -y

# requirements
apt install -y software-properties-common curl zip unzip git gcc

# certbot
apt install certbot python3-certbot-nginx -y

# nginx (for user-managed sites only, Vito itself uses FrankenPHP)
export V_NGINX_CONFIG="
    user vito;
    worker_processes auto;
    pid /run/nginx.pid;
    include /etc/nginx/modules-enabled/*.conf;
    events {
        worker_connections 768;
    }
    http {
        sendfile on;
        tcp_nopush on;
        tcp_nodelay on;
        keepalive_timeout 65;
        types_hash_max_size 2048;
        include /etc/nginx/mime.types;
        default_type application/octet-stream;
        ssl_protocols TLSv1 TLSv1.1 TLSv1.2; # Dropping SSLv3, ref: POODLE
        ssl_prefer_server_ciphers on;
        access_log /var/log/nginx/access.log;
        error_log /var/log/nginx/error.log;
        gzip on;
        include /etc/nginx/conf.d/*.conf;
        include /etc/nginx/sites-enabled/*;
    }
"
apt install nginx -y
if ! echo "${V_NGINX_CONFIG}" | tee /etc/nginx/nginx.conf; then
  echo "Can't configure nginx!" && exit 1
fi
rm -f /etc/nginx/sites-available/default
rm -f /etc/nginx/sites-enabled/default
service nginx start

# frankenphp
echo "Downloading FrankenPHP..."
mkdir -p /home/vito/bin
ARCH=$(dpkg --print-architecture)
if [ "$ARCH" = "amd64" ]; then ARCH="x86_64"; elif [ "$ARCH" = "arm64" ]; then ARCH="aarch64"; fi
curl -L -o /home/vito/bin/frankenphp \
  "https://github.com/dunglas/frankenphp/releases/latest/download/frankenphp-linux-${ARCH}"
chmod +x /home/vito/bin/frankenphp
chown vito:vito /home/vito/bin/frankenphp
setcap cap_net_bind_service=+ep /home/vito/bin/frankenphp

# create php wrapper so @php and composer scripts work via FrankenPHP
printf '#!/bin/sh\nexec /home/vito/bin/frankenphp php-cli "$@"\n' > /home/vito/bin/php
chmod +x /home/vito/bin/php
chown vito:vito /home/vito/bin/php
echo 'export PATH="/home/vito/bin:$PATH"' | tee -a /home/vito/.bashrc /home/vito/.profile > /dev/null
chown vito:vito /home/vito/.bashrc /home/vito/.profile
export PATH="/home/vito/bin:$PATH"

# nodejs
export V_NODE_VERSION="20.x"
curl -fsSL https://deb.nodesource.com/setup_${V_NODE_VERSION} | sudo -E bash -
apt install -y nodejs

# composer (uses FrankenPHP's bundled PHP)
curl -sS https://getcomposer.org/installer -o /tmp/composer-setup.php
/home/vito/bin/frankenphp php-cli /tmp/composer-setup.php -- --install-dir=/usr/local/bin --filename=composer
rm -f /tmp/composer-setup.php
if [[ ! -f /usr/local/bin/composer ]]; then
  echo "Composer installation failed!" && exit 1
fi

# redis
apt install redis-server -y
service redis enable
service redis start

# setup website
export COMPOSER_ALLOW_SUPERUSER=1
export V_REPO="https://github.com/vitodeploy/vito.git"
rm -rf /home/vito/vito
mkdir /home/vito/vito
chown -R vito:vito /home/vito/vito
chmod -R 755 /home/vito/vito
rm -rf /home/vito/vito
git config --global core.fileMode false
git clone -b ${VITO_VERSION} ${V_REPO} /home/vito/vito
find /home/vito/vito -type d -exec chmod 755 {} \;
find /home/vito/vito -type f -exec chmod 644 {} \;
cd /home/vito/vito && git config core.fileMode false
cd /home/vito/vito
if [[ "${VITO_CHANNEL}" == "release" ]]; then
  VITO_TAG=$(git tag -l --merged ${VITO_VERSION} --sort=-v:refname | head -n 1)

  if [[ -n "${VITO_TAG}" ]]; then
    git checkout ${VITO_TAG}
  else
    echo "No release tag found for ${VITO_VERSION}, using branch instead."
  fi
fi
if ! /home/vito/bin/frankenphp php-cli /usr/local/bin/composer install --no-dev --no-scripts; then
  echo "Composer install failed!" && exit 1
fi
/home/vito/bin/frankenphp php-cli artisan package:discover --ansi
cp .env.prod .env
sed -i "s|^APP_URL=.*|APP_URL=${VITO_APP_URL}|" .env
touch /home/vito/vito/storage/database.sqlite
/home/vito/bin/frankenphp php-cli artisan key:generate
/home/vito/bin/frankenphp php-cli artisan storage:link
/home/vito/bin/frankenphp php-cli artisan migrate --force
/home/vito/bin/frankenphp php-cli artisan user:create Vito ${V_ADMIN_EMAIL} ${V_ADMIN_PASSWORD}
openssl genpkey -algorithm RSA -out /home/vito/vito/storage/ssh-private.pem
chmod 600 /home/vito/vito/storage/ssh-private.pem
ssh-keygen -y -f /home/vito/vito/storage/ssh-private.pem > /home/vito/vito/storage/ssh-public.key
chown -R vito:vito /home/vito/vito/storage/ssh-private.pem
chown -R vito:vito /home/vito/vito/storage/ssh-public.key

# add app public key to authorized_keys for local server management
cat /home/vito/vito/storage/ssh-public.key >> /home/vito/.ssh/authorized_keys
chown vito:vito /home/vito/.ssh/authorized_keys
chmod 600 /home/vito/.ssh/authorized_keys

# add env vars
echo "VITO_PORT=${VITO_PORT}" >> .env
echo "VITO_MODE=local" >> .env
echo "VITO_SSL=false" >> .env

# generate Caddyfile
if ! /home/vito/bin/frankenphp php-cli artisan vito:generate-caddyfile; then
  echo "Failed to generate Caddyfile!" && exit 1
fi

# setup local server
/home/vito/bin/frankenphp php-cli artisan server:setup-local

# allow Vito port in firewall
ufw allow ${VITO_PORT}/tcp 2>/dev/null || true

# optimize
/home/vito/bin/frankenphp php-cli artisan optimize

# cleanup
chown -R vito:vito /home/vito

# setup supervisor
apt-get install supervisor -y
service supervisor enable
service supervisor start
mkdir -p /home/vito/.logs
mkdir -p /home/vito/.logs/workers

# octane (FrankenPHP serves Vito)
export V_OCTANE_CONFIG="
[program:octane]
process_name=%(program_name)s
command=/home/vito/bin/frankenphp run --config /home/vito/vito/Caddyfile
directory=/home/vito/vito
autostart=1
autorestart=1
user=vito
environment=HOME=\"/home/vito\",PATH=\"/home/vito/bin:%(ENV_PATH)s\"
redirect_stderr=true
stdout_logfile=/home/vito/.logs/workers/octane.log
stopwaitsecs=10
"
touch /home/vito/.logs/workers/octane.log
echo "${V_OCTANE_CONFIG}" | tee /etc/supervisor/conf.d/octane.conf

# worker
export V_WORKER_CONFIG="
[program:worker]
process_name=%(program_name)s_%(process_num)02d
command=/home/vito/bin/frankenphp php-cli /home/vito/vito/artisan horizon
directory=/home/vito/vito
autostart=1
autorestart=1
user=vito
environment=HOME=\"/home/vito\",PATH=\"/home/vito/bin:%(ENV_PATH)s\"
redirect_stderr=true
stdout_logfile=/home/vito/.logs/workers/worker.log
stopwaitsecs=3600
"
touch /home/vito/.logs/workers/worker.log
echo "${V_WORKER_CONFIG}" | tee /etc/supervisor/conf.d/worker.conf

# websocket server
export V_WEBSOCKET_CONFIG="
[program:websocket]
process_name=%(program_name)s
command=/home/vito/bin/frankenphp php-cli /home/vito/vito/artisan ws:serve
directory=/home/vito/vito
autostart=1
autorestart=1
user=vito
environment=HOME=\"/home/vito\",PATH=\"/home/vito/bin:%(ENV_PATH)s\"
redirect_stderr=true
stdout_logfile=/home/vito/.logs/workers/websocket.log
"
touch /home/vito/.logs/workers/websocket.log
echo "${V_WEBSOCKET_CONFIG}" | tee /etc/supervisor/conf.d/websocket.conf
supervisorctl reread
supervisorctl update

# start processes
supervisorctl start octane
supervisorctl start worker:*
supervisorctl start websocket

# setup cronjobs
echo "* * * * * cd /home/vito/vito && /home/vito/bin/frankenphp php-cli artisan schedule:run >> /dev/null 2>&1" | sudo -u vito crontab -

# print info
echo "🎉 Congratulations!"
echo "✅ You can access Vito at: ${VITO_APP_URL}"
echo "✅ SSH User: vito"
echo "✅ SSH Password: ${V_PASSWORD}"
echo "✅ Admin Email: ${V_ADMIN_EMAIL}"
echo "✅ Admin Password: ${V_ADMIN_PASSWORD}"
