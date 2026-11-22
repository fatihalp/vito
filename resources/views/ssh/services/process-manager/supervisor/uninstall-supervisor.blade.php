sudo systemctl stop supervisor 2>/dev/null || true
sudo systemctl disable supervisor 2>/dev/null || true

sudo DEBIAN_FRONTEND=noninteractive apt-get purge -y supervisor 2>/dev/null || true

sudo rm -rf /etc/supervisor
sudo rm -rf /var/log/supervisor
sudo rm -rf /var/run/supervisor

sudo systemctl daemon-reload 2>/dev/null || true
sudo systemctl reset-failed supervisor 2>/dev/null || true
