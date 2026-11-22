sudo service caddy stop 2>/dev/null || true

sudo DEBIAN_FRONTEND=noninteractive apt-get purge -y caddy 2>/dev/null || true

sudo rm -rf /etc/caddy
sudo rm -rf /var/log/caddy
sudo rm -rf /var/lib/caddy
sudo rm -rf /var/cache/caddy
sudo rm -rf /usr/share/caddy
sudo rm -rf /var/www/vito-splash
sudo rm -rf /etc/systemd/system/caddy.service

sudo systemctl daemon-reload 2>/dev/null || true
sudo systemctl reset-failed caddy 2>/dev/null || true
