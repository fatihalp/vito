sudo systemctl stop valkey-server 2>/dev/null || true
sudo systemctl disable valkey-server 2>/dev/null || true

sudo DEBIAN_FRONTEND=noninteractive apt-get purge -y valkey-server valkey-tools 2>/dev/null || true

sudo rm -rf /etc/valkey
sudo rm -rf /var/lib/valkey
sudo rm -rf /var/log/valkey
sudo rm -rf /var/run/valkey

sudo systemctl daemon-reload 2>/dev/null || true
sudo systemctl reset-failed valkey-server 2>/dev/null || true

sudo DEBIAN_FRONTEND=noninteractive apt-get autoremove -y 2>/dev/null || true
sudo DEBIAN_FRONTEND=noninteractive apt-get autoclean -y 2>/dev/null || true
