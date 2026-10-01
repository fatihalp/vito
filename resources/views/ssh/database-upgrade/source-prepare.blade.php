SQL_FILE={!! escapeshellarg($sqlPath) !!}
trap 'sudo rm -f "$SQL_FILE"' EXIT

if [ "$(sudo -u postgres psql -XtAc 'SELECT pg_is_in_recovery()')" = "t" ]; then
    echo "VITO_SSH_ERROR: this server is a standby, run the upgrade from the primary"
    exit 1
fi

sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -f "$SQL_FILE" > /dev/null

@include('ssh.database-upgrade.source-access')

{
@if ($logical)
    echo "wal_level = 'logical'"
@endif
    echo "max_replication_slots = {{ (int) $slots }}"
    echo "max_wal_senders = {{ (int) $senders }}"
} | sudo tee "$CONF_DIR/zz-vito-upgrade.conf" > /dev/null
sudo chmod 644 "$CONF_DIR/zz-vito-upgrade.conf"
sudo -u postgres psql -XtAc 'SELECT pg_reload_conf()' > /dev/null

@if ($replicaIdentity)
@foreach ($databases as $database)
sudo -u postgres psql -XtAq -v ON_ERROR_STOP=1 -d {!! escapeshellarg($database) !!} -c "
    SELECT format('ALTER TABLE %I.%I REPLICA IDENTITY FULL;', n.nspname, c.relname)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND c.relpersistence = 'p' AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\_toast%'
        AND (c.relreplident = 'n' OR (c.relreplident = 'd' AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.oid AND i.indisprimary)))" \
    | sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d {!! escapeshellarg($database) !!} > /dev/null
@endforeach
@endif

@foreach ($databases as $database)
if [ "$(sudo -u postgres psql -XtAq -v ON_ERROR_STOP=1 -d {!! escapeshellarg($database) !!} -c "SELECT 1 FROM pg_publication WHERE pubname = :'pub'" -v pub={!! escapeshellarg($publication) !!})" != "1" ]; then
    sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d {!! escapeshellarg($database) !!} -c "CREATE PUBLICATION :\"pub\" FOR ALL TABLES" -v pub={!! escapeshellarg($publication) !!} > /dev/null
fi
@endforeach

echo "VITO_WAL_LEVEL=$(sudo -u postgres psql -XtAc 'SHOW wal_level')"
echo "VITO_MAX_REPLICATION_SLOTS=$(sudo -u postgres psql -XtAc 'SHOW max_replication_slots')"
echo "VITO_MAX_WAL_SENDERS=$(sudo -u postgres psql -XtAc 'SHOW max_wal_senders')"
echo "VITO_PORT=$(sudo -u postgres psql -XtAc 'SHOW port')"
echo "VITO_SSL=$(sudo -u postgres psql -XtAc 'SHOW ssl')"
