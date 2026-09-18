sudo tee /etc/systemd/system/vito-pgbackrest-server.service > /dev/null <<'VITO_UNIT'
[Unit]
Description=pgBackRest TLS server (Vito)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=postgres
Group=postgres
ExecStart=/usr/bin/pgbackrest server
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
VITO_UNIT

sudo systemctl daemon-reload
sudo systemctl enable vito-pgbackrest-server > /dev/null 2>&1
sudo systemctl restart vito-pgbackrest-server
sleep 2
sudo systemctl is-active --quiet vito-pgbackrest-server || { sudo journalctl -u vito-pgbackrest-server -n 20 --no-pager; echo "VITO_SSH_ERROR: the pgBackRest TLS server did not start"; exit 1; }
