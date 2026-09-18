set -euo pipefail

PGDATA={!! escapeshellarg($dataDirectory) !!}
SERVICE={!! escapeshellarg('postgresql@'.$version.'-main') !!}

if [ -z "$PGDATA" ] || [ "$PGDATA" = "/" ]; then
    echo "Refusing to use the data directory '$PGDATA'"
    exit 1
fi

echo "Checking the backup repository"
sudo -u postgres pgbackrest --stanza={!! escapeshellarg($stanza) !!} info

echo "Stopping PostgreSQL and clearing $PGDATA"
systemctl stop postgresql
find "$PGDATA" -mindepth 1 -delete

echo "Restoring {!! $label !!}"
sudo -u postgres pgbackrest --stanza={!! escapeshellarg($stanza) !!} --archive-mode=off {!! $options !!} restore

echo "Starting PostgreSQL and replaying WAL up to the restore point"
systemctl start postgresql

while true; do
    if ! systemctl is-active --quiet "$SERVICE"; then
        journalctl -u "$SERVICE" -n 20 --no-pager || true
        tail -n 30 {!! escapeshellarg('/var/log/postgresql/postgresql-'.$version.'-main.log') !!} 2>/dev/null || true
        echo "PostgreSQL stopped while replaying WAL, see the log above"
        exit 1
    fi

    if sudo -u postgres pg_isready -q && [ "$(sudo -u postgres psql -XtAc 'SELECT pg_is_in_recovery()')" = "f" ]; then
        break
    fi

    sleep 10
done

echo "Removing the recovery settings and the backup repository credentials"
sudo -u postgres psql -Xq -v ON_ERROR_STOP=1 \
@foreach (['restore_command', 'recovery_target', 'recovery_target_name', 'recovery_target_time', 'recovery_target_xid', 'recovery_target_lsn', 'recovery_target_inclusive', 'recovery_target_action', 'recovery_target_timeline', 'archive_mode'] as $setting)
    -c {!! escapeshellarg('ALTER SYSTEM RESET '.$setting) !!} \
@endforeach
    -c 'SELECT pg_reload_conf()'

echo "Removing the replication logins of the source cluster"
sudo -u postgres psql -Xq -v ON_ERROR_STOP=1 -c "DO \$\$ DECLARE r record; BEGIN FOR r IN SELECT rolname FROM pg_roles WHERE rolname LIKE 'vito\\_replica\\_%' LOOP EXECUTE format('DROP ROLE %I', r.rolname); END LOOP; END \$\$;"
rm -f /etc/pgbackrest/pgbackrest.conf
rm -rf /var/spool/pgbackrest

echo "The restore finished and PostgreSQL accepts connections"
