sudo service vito-agent stop 2>/dev/null || true

sudo systemctl disable vito-agent 2>/dev/null || true

sudo rm -f /usr/local/bin/vito-agent

sudo rm -f /etc/systemd/system/vito-agent.service

sudo rm -rf /etc/vito-agent

sudo systemctl daemon-reload 2>/dev/null || true
sudo systemctl reset-failed vito-agent 2>/dev/null || true

echo "Pure Agent uninstalled successfully"
