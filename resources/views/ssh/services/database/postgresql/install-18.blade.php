#!/bin/bash

# Stop PostgreSQL and remove only installed PostgreSQL packages.
sudo systemctl stop postgresql 2>/dev/null || true
sudo service postgresql stop 2>/dev/null || true

INSTALLED_POSTGRES_PACKAGES=$(dpkg-query -W -f='${binary:Package}\n' 'postgresql*' 2>/dev/null | grep -E '^postgresql' || true)
if [ -n "$INSTALLED_POSTGRES_PACKAGES" ]; then
    echo "$INSTALLED_POSTGRES_PACKAGES" | xargs sudo DEBIAN_FRONTEND=noninteractive apt-get purge -y
fi
sudo DEBIAN_FRONTEND=noninteractive apt-get autoremove -y 2>/dev/null || true
sudo DEBIAN_FRONTEND=noninteractive apt-get autoclean 2>/dev/null || true

# Remove old repository and keys
sudo rm -f /etc/apt/sources.list.d/pgdg.list
sudo rm -f /usr/share/keyrings/postgresql-archive-keyring.gpg
sudo apt-key del ACCC4CF8 2>/dev/null || true

sudo DEBIAN_FRONTEND=noninteractive apt-get update

sudo DEBIAN_FRONTEND=noninteractive apt-get install -y wget lsb-release gnupg

# Import PostgreSQL GPG key to modern keyring location
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo gpg --dearmor -o /usr/share/keyrings/postgresql-archive-keyring.gpg

# Add PostgreSQL repository with signed-by directive
CODENAME=$(lsb_release -cs)
echo "deb [signed-by=/usr/share/keyrings/postgresql-archive-keyring.gpg] https://apt.postgresql.org/pub/repos/apt ${CODENAME}-pgdg main" | sudo tee /etc/apt/sources.list.d/pgdg.list

sudo DEBIAN_FRONTEND=noninteractive apt-get update -y

sudo DEBIAN_FRONTEND=noninteractive apt-get install postgresql-18 -y

systemctl status postgresql

sudo -u postgres psql -c "SELECT version();"
