set -euo pipefail

PGDATA={!! escapeshellarg($dataDirectory) !!}
SERVICE={!! escapeshellarg('postgresql@'.$version.'-main') !!}
SETTINGS={!! escapeshellarg($confDirectory.'/zz-vito-restore.conf') !!}
LOG={!! escapeshellarg('/var/log/postgresql/postgresql-'.$version.'-main.log') !!}

set_setting() {
    touch "$SETTINGS"
    sed -i "/^$1 = /d" "$SETTINGS"
    echo "$1 = $2" >> "$SETTINGS"
    chmod 644 "$SETTINGS"
}

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

echo "Matching max_connections and the other settings recovery needs to the source cluster"
mkdir -p "$(dirname "$SETTINGS")"
rm -f "$SETTINGS"
CONTROL=$(sudo -u postgres {!! escapeshellarg('/usr/lib/postgresql/'.$version.'/bin/pg_controldata') !!} "$PGDATA")
for PAIR in max_connections:max_connections max_worker_processes:max_worker_processes max_wal_senders:max_wal_senders max_prepared_transactions:max_prepared_xacts max_locks_per_transaction:max_locks_per_xact; do
    VALUE=$(echo "$CONTROL" | awk -F: -v key="${PAIR#*:} setting" '$1 == key {gsub(/[^0-9]/, "", $2); print $2}')
    if [ -n "$VALUE" ]; then
        set_setting "${PAIR%%:*}" "$VALUE"
        echo "${PAIR%%:*} = $VALUE"
    fi
done

START_LINE=$(wc -l < "$LOG" 2>/dev/null || echo 0)
RAISES=0

echo "Starting PostgreSQL and replaying WAL up to the restore point"
systemctl start postgresql

while true; do
    RAISED=$(tail -n +"$((START_LINE + 1))" "$LOG" 2>/dev/null | sed -nE 's/.* ([a-z_]+) = [0-9]+ is a lower setting than on the primary server, where its value was ([0-9]+).*/\1 \2/p' | sort -u || true)

    if [ -n "$RAISED" ] && [ "$RAISES" -lt 5 ]; then
        while read -r NAME VALUE; do
            set_setting "$NAME" "$VALUE"
            echo "The WAL needs $NAME = $VALUE as on the source cluster, restarting PostgreSQL with it"
        done <<< "$RAISED"
        RAISES=$((RAISES + 1))
        START_LINE=$(wc -l < "$LOG" 2>/dev/null || echo 0)
        systemctl reset-failed "$SERVICE" > /dev/null 2>&1 || true
        systemctl restart "$SERVICE"
        continue
    fi

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
