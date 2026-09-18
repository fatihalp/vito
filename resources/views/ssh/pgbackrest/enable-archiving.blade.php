PG_CONF={!! escapeshellarg('/etc/postgresql/'.$version.'/main/postgresql.conf') !!}
PG_CONF_DIR={!! escapeshellarg('/etc/postgresql/'.$version.'/main/conf.d') !!}

sudo grep -Eq '^[[:space:]]*include_dir[[:space:]]*=' "$PG_CONF" || printf "\ninclude_dir = 'conf.d'\n" | sudo tee -a "$PG_CONF" > /dev/null
sudo mkdir -p "$PG_CONF_DIR"
printf "archive_mode = on\narchive_command = 'pgbackrest --stanza=%s archive-push %%p'\n" {!! escapeshellarg($stanza) !!} | sudo tee "$PG_CONF_DIR/zz-vito-pgbackrest.conf" > /dev/null

if [ "$(sudo -u postgres psql -tAc 'SHOW archive_mode')" = "on" ]; then
    sudo -u postgres psql -tAc 'SELECT pg_reload_conf()' > /dev/null
else
    echo "Restarting PostgreSQL to turn on WAL archiving"
    sudo systemctl restart postgresql
    for attempt in $(seq 1 60); do
        sudo -u postgres pg_isready -q && break
        sleep 1
    done
fi

sudo -u postgres pgbackrest --stanza={!! escapeshellarg($stanza) !!} stanza-create
sudo -u postgres pgbackrest --stanza={!! escapeshellarg($stanza) !!} check
