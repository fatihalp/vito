PG_CONF_DIR={!! escapeshellarg('/etc/postgresql/'.$version.'/main/conf.d') !!}

sudo systemctl stop 'vito-pgbackrest-*' > /dev/null 2>&1 || true

if sudo test -f "$PG_CONF_DIR/zz-vito-pgbackrest.conf"; then
    printf "archive_mode = off\narchive_command = '/bin/true'\n" | sudo tee "$PG_CONF_DIR/zz-vito-pgbackrest.conf" > /dev/null
    sudo -u postgres psql -tAc 'SELECT pg_reload_conf()' > /dev/null
fi
