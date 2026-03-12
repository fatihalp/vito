#!/bin/bash

echo "⚠️  Resetting Vito installation — this will remove everything!"
echo "=================================================="

if [[ "${CONFIRM_RESET}" != "yes" ]]; then
  read -p "Are you sure? (yes/no): " CONFIRM < /dev/tty
  if [[ "$CONFIRM" != "yes" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# stop and remove supervisor processes
echo "Stopping supervisor processes..."
supervisorctl stop all 2>/dev/null || true
rm -f /etc/supervisor/conf.d/octane.conf
rm -f /etc/supervisor/conf.d/worker.conf
rm -f /etc/supervisor/conf.d/websocket.conf
supervisorctl reread 2>/dev/null || true
supervisorctl update 2>/dev/null || true

# remove crontab
echo "Removing crontab..."
crontab -r -u vito 2>/dev/null || true

# remove vito files
echo "Removing Vito files..."
rm -rf /home/vito/vito
rm -rf /home/vito/bin
rm -rf /home/vito/.logs
rm -rf /home/vito/.ssh
rm -rf /home/vito/.bash_history
rm -rf /home/vito/.bashrc
rm -rf /home/vito/.profile
rm -rf /home/vito/.cache
rm -rf /home/vito/.config
rm -rf /home/vito/.local

# remove nginx vhost if exists
echo "Cleaning nginx..."
rm -f /etc/nginx/sites-available/vito
rm -f /etc/nginx/sites-enabled/vito
service nginx stop 2>/dev/null || true

# uninstall packages
echo "Removing packages..."
apt-get purge -y nginx nginx-common supervisor redis-server nodejs certbot python3-certbot-nginx 2>/dev/null || true
apt-get autoremove -y 2>/dev/null || true

# remove composer
rm -f /usr/local/bin/composer

# remove nodesource list
rm -f /etc/apt/sources.list.d/nodesource.list

# remove vito user
echo "Removing vito user..."
userdel -r vito 2>/dev/null || true

# remove sudoers entry
sed -i '/^vito ALL=(ALL) NOPASSWD:ALL$/d' /etc/sudoers

# remove firewall rule
ufw delete allow 54331/tcp 2>/dev/null || true
ufw delete allow 8080/tcp 2>/dev/null || true

echo ""
echo "✅ Server has been reset. You can run the install script again."
