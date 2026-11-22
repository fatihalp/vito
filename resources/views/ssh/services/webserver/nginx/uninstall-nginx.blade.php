sudo service nginx stop 2>/dev/null || true

sudo DEBIAN_FRONTEND=noninteractive apt-get purge -y nginx nginx-common nginx-full 2>/dev/null || true

sudo rm -rf /etc/nginx
sudo rm -rf /var/log/nginx
sudo rm -rf /var/lib/nginx
sudo rm -rf /var/cache/nginx
sudo rm -rf /usr/share/nginx
sudo rm -rf /var/www/vito-splash
sudo rm -rf /etc/systemd/system/nginx.service

sudo systemctl daemon-reload 2>/dev/null || true
sudo systemctl reset-failed nginx 2>/dev/null || true
