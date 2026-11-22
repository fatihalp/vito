sudo DEBIAN_FRONTEND=noninteractive apt-get purge -y goaccess 2>/dev/null || true

sudo rm -rf /var/lib/goaccess

sudo rm -f /etc/apt/sources.list.d/goaccess.list /usr/share/keyrings/goaccess.gpg
