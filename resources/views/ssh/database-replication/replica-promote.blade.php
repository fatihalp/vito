CONF_DIR={!! escapeshellarg($confDirectory) !!}

if ! sudo -u postgres pg_isready -q; then
    echo "VITO_SSH_ERROR: PostgreSQL is not running on the replica, it cannot be promoted"
    exit 1
fi

if [ "$(sudo -u postgres psql -XtAc 'SELECT pg_is_in_recovery()')" = "t" ]; then
    echo "Promoting the replica to primary"
    if [ "$(sudo -u postgres psql -XtAc 'SELECT pg_promote(true, 120)')" != "t" ]; then
        echo "VITO_SSH_ERROR: PostgreSQL did not finish promotion within 120 seconds"
        exit 1
    fi
fi

sudo rm -f "$CONF_DIR/zz-vito-replica.conf"
sudo -u postgres psql -XtAc 'SELECT pg_reload_conf()' > /dev/null

if [ "$(sudo -u postgres psql -XtAc 'SHOW archive_mode')" != "on" ]; then
    echo "Turning on WAL archiving, PostgreSQL restarts once"
    sudo -u postgres psql -XtAc 'ALTER SYSTEM RESET archive_mode' > /dev/null
    sudo systemctl restart postgresql
    for attempt in $(seq 1 60); do
        sudo -u postgres pg_isready -q && break
        sleep 1
    done
fi

@foreach ($files as $file)
sudo rm -f {!! escapeshellarg($file) !!}
@endforeach
