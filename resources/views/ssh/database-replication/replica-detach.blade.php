PGDATA={!! escapeshellarg($dataDirectory) !!}
CONF_DIR={!! escapeshellarg($confDirectory) !!}

sudo systemctl stop {!! escapeshellarg($unit) !!} > /dev/null 2>&1 || true
sudo systemctl reset-failed {!! escapeshellarg($unit) !!} > /dev/null 2>&1 || true

echo "Stopping WAL archiving into the cluster repository"
printf "archive_mode = off\narchive_command = '/bin/true'\n" | sudo tee "$CONF_DIR/zz-vito-pgbackrest.conf" > /dev/null

if sudo -u postgres pg_isready -q; then
    sudo -u postgres psql -XtAc 'SELECT pg_reload_conf()' > /dev/null
    if [ "$(sudo -u postgres psql -XtAc 'SELECT pg_is_in_recovery()')" = "t" ]; then
        echo "Promoting the replica into an independent server"
        if [ "$(sudo -u postgres psql -XtAc 'SELECT pg_promote(true, 120)')" != "t" ]; then
            echo "VITO_SSH_ERROR: PostgreSQL did not finish promotion within 120 seconds"
            exit 1
        fi
    fi
    sudo rm -f "$CONF_DIR/zz-vito-replica.conf"
    sudo -u postgres psql -XtAc 'SELECT pg_reload_conf()' > /dev/null
elif [ -n "$PGDATA" ] && [ "$PGDATA" != "/" ]; then
    echo "PostgreSQL is not running, removing the standby signal so it starts as an independent server"
    sudo rm -f "$PGDATA/standby.signal" "$CONF_DIR/zz-vito-replica.conf"
fi

sudo rm -rf /etc/pgbackrest/pgbackrest.conf /etc/pgbackrest/tls
@foreach ($files as $file)
sudo rm -f {!! escapeshellarg($file) !!}
@endforeach
