sudo systemctl disable --now vito-pgbackrest-server > /dev/null 2>&1 || true
sudo rm -f /etc/systemd/system/vito-pgbackrest-server.service
sudo systemctl daemon-reload
