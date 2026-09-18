set -euo pipefail

PGDATA={!! escapeshellarg($dataDirectory) !!}
CONF_DIR={!! escapeshellarg($confDirectory) !!}
CONNINFO={!! escapeshellarg($conninfo) !!}

if [ -z "$PGDATA" ] || [ "$PGDATA" = "/" ]; then
    echo "Refusing to use the data directory '$PGDATA'"
    exit 1
fi

echo "Checking the replication connection to the primary"
sudo -u postgres psql "$CONNINFO dbname=replication replication=true connect_timeout=15" -XAtc "IDENTIFY_SYSTEM;"

echo "Checking the pgBackRest repository"
sudo -u postgres pgbackrest --stanza={!! escapeshellarg($stanza) !!} info > /dev/null

echo "Stopping PostgreSQL"
systemctl unmask postgresql {!! escapeshellarg('postgresql@'.$version.'-main') !!} > /dev/null 2>&1 || true
systemctl stop postgresql
rm -f "$CONF_DIR/zz-vito-replica.conf"
sed -i '/^# BEGIN VITO REPLICATION$/,/^# END VITO REPLICATION$/d' "$(dirname "$CONF_DIR")/pg_hba.conf" 2>/dev/null || true

@if ($delta)
echo "Restoring the latest backup over the existing data (delta)"
sudo -u postgres pgbackrest --stanza={!! escapeshellarg($stanza) !!} --type=standby --delta restore
@else
echo "Clearing $PGDATA and restoring the latest backup"
find "$PGDATA" -mindepth 1 -delete
sudo -u postgres pgbackrest --stanza={!! escapeshellarg($stanza) !!} --type=standby restore
@endif

sed -i '/^[[:space:]]*primary_conninfo[[:space:]]*=/d; /^[[:space:]]*primary_slot_name[[:space:]]*=/d; /^[[:space:]]*archive_mode[[:space:]]*=/d' "$PGDATA/postgresql.auto.conf" 2>/dev/null || true
sudo -u postgres touch "$PGDATA/standby.signal"

PG_CONF="$(dirname "$CONF_DIR")/postgresql.conf"
grep -Eq '^[[:space:]]*include_dir[[:space:]]*=' "$PG_CONF" || printf "\ninclude_dir = 'conf.d'\n" >> "$PG_CONF"
mkdir -p "$CONF_DIR"
printf "archive_mode = on\narchive_command = 'pgbackrest --stanza=%s archive-push %%p'\n" {!! escapeshellarg($stanza) !!} > "$CONF_DIR/zz-vito-pgbackrest.conf"
cat > "$CONF_DIR/zz-vito-replica.conf" <<'VITO_REPLICA_CONF'
hot_standby = on
hot_standby_feedback = off
max_standby_streaming_delay = '30s'
default_transaction_read_only = on
primary_conninfo = '{!! $conninfo !!}'
primary_slot_name = '{!! $slot !!}'
@foreach ($settings as $name => $value)
{!! $name !!} = {!! (int) $value !!}
@endforeach
VITO_REPLICA_CONF
@if ($listenAddresses)
printf "listen_addresses = '%s'\n" {!! escapeshellarg($listenAddresses) !!} > "$CONF_DIR/zz-vito-networking.conf"
chmod 644 "$CONF_DIR/zz-vito-networking.conf"
@endif
chmod 644 "$CONF_DIR/zz-vito-pgbackrest.conf" "$CONF_DIR/zz-vito-replica.conf"

echo "Starting PostgreSQL as a standby"
systemctl enable postgresql > /dev/null 2>&1 || true
systemctl start postgresql

for attempt in $(seq 1 60); do
    if sudo -u postgres pg_isready -q; then
        if [ "$(sudo -u postgres psql -XtAc 'SELECT pg_is_in_recovery()')" != "t" ]; then
            echo "PostgreSQL started, but not as a standby"
            exit 1
        fi
        echo "The replica accepts read-only connections"
        exit 0
    fi
    sleep 5
done

echo "PostgreSQL is still replaying WAL, the health check will report when it is ready"
