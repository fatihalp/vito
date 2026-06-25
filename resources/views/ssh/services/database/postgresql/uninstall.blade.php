sudo service postgresql stop
sudo systemctl stop postgresql 2>/dev/null || true

INSTALLED_POSTGRES_PACKAGES=$(dpkg-query -W -f='${binary:Package}\n' 'postgresql*' 2>/dev/null | grep -E '^postgresql' || true)
if [ -n "$INSTALLED_POSTGRES_PACKAGES" ]; then
    echo "$INSTALLED_POSTGRES_PACKAGES" | xargs sudo DEBIAN_FRONTEND=noninteractive apt-get purge -y
fi
sudo DEBIAN_FRONTEND=noninteractive apt-get autoremove -y
sudo DEBIAN_FRONTEND=noninteractive apt-get autoclean -y

# Remove repository and keys
sudo rm -f /etc/apt/sources.list.d/pgdg.list
sudo rm -f /usr/share/keyrings/postgresql-archive-keyring.gpg
sudo apt-key del ACCC4CF8 2>/dev/null || true

sudo rm -rf /etc/postgresql
sudo rm -rf /var/lib/postgresql
sudo rm -rf /var/log/postgresql
sudo rm -rf /var/run/postgresql
sudo rm -rf /var/run/postgresql/postmaster.pid
sudo rm -rf /var/run/postgresql/.s.PGSQL.5432
sudo rm -rf /var/run/postgresql/.s.PGSQL.5432.lock
