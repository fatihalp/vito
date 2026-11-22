sudo systemctl stop redis-server 2>/dev/null || true
sudo systemctl disable redis-server 2>/dev/null || true

sudo DEBIAN_FRONTEND=noninteractive apt-get purge -y redis-server redis-tools 2>/dev/null || true

sudo rm -rf /etc/redis
sudo rm -rf /var/lib/redis
sudo rm -rf /var/log/redis
sudo rm -rf /var/run/redis

sudo systemctl daemon-reload 2>/dev/null || true
sudo systemctl reset-failed redis-server 2>/dev/null || true

sudo DEBIAN_FRONTEND=noninteractive apt-get autoremove -y 2>/dev/null || true
sudo DEBIAN_FRONTEND=noninteractive apt-get autoclean -y 2>/dev/null || true
