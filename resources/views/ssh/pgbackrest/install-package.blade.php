sudo DEBIAN_FRONTEND=noninteractive apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y pgbackrest

PGBACKREST_VERSION=$(pgbackrest version | awk '{print $2}')
if dpkg --compare-versions "$PGBACKREST_VERSION" lt 2.46; then
    echo "VITO_SSH_ERROR: pgBackRest $PGBACKREST_VERSION is too old, 2.46 or newer is required"
    exit 1
fi

sudo install -d -o postgres -g postgres -m 750 /var/log/pgbackrest /var/lib/pgbackrest /var/spool/pgbackrest
sudo install -d -m 755 /etc/pgbackrest
