sudo systemctl stop postgresql 2>/dev/null || true
sudo service postgresql stop 2>/dev/null || true

sudo DEBIAN_FRONTEND=noninteractive apt-get remove -y postgresql-* 2>/dev/null || true
sudo DEBIAN_FRONTEND=noninteractive apt-get autoremove -y 2>/dev/null || true
sudo DEBIAN_FRONTEND=noninteractive apt-get autoclean -y 2>/dev/null || true

sudo rm -f /etc/apt/sources.list.d/pgdg.list
sudo rm -f /usr/share/keyrings/postgresql-archive-keyring.gpg
sudo apt-key del ACCC4CF8 2>/dev/null || true

sudo rm -rf /var/log/postgresql
sudo rm -rf /var/run/postgresql
