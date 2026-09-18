SQL_FILE={!! escapeshellarg($sqlPath) !!}
trap 'sudo rm -f "$SQL_FILE"' EXIT

if [ "$(sudo -u postgres psql -XtAc 'SELECT pg_is_in_recovery()')" = "t" ]; then
    echo "VITO_SSH_ERROR: the primary server is itself a standby, cascading replicas are not supported"
    exit 1
fi

if [ "$(( $(sudo -u postgres psql -XtAc 'SHOW server_version_num') / 10000 ))" != "{{ (int) $majorVersion }}" ]; then
    echo "VITO_SSH_ERROR: the primary and the replica run different PostgreSQL major versions"
    exit 1
fi

if [ "$(sudo -u postgres psql -XtAc 'SHOW wal_level')" = "minimal" ]; then
    echo "VITO_SSH_ERROR: wal_level is minimal, set it to replica and restart PostgreSQL before adding a replica"
    exit 1
fi

if [ "$(sudo -u postgres psql -XtAc "SELECT current_setting('max_wal_senders')::int - (SELECT count(*) FROM pg_stat_replication)")" -le 0 ]; then
    echo "VITO_SSH_ERROR: max_wal_senders is used up, raise it and restart PostgreSQL"
    exit 1
fi

if [ "$(sudo -u postgres psql -XtAc "SELECT current_setting('max_replication_slots')::int - (SELECT count(*) FROM pg_replication_slots WHERE slot_name <> '{!! $slot !!}')")" -le 0 ]; then
    echo "VITO_SSH_ERROR: max_replication_slots is used up, raise it and restart PostgreSQL"
    exit 1
fi

sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -f "$SQL_FILE" > /dev/null

@include('ssh.database-replication.primary-access')

echo "VITO_PORT=$(sudo -u postgres psql -XtAc 'SHOW port')"
echo "VITO_SSL=$(sudo -u postgres psql -XtAc 'SHOW ssl')"
sudo -u postgres psql -XtAc "SELECT 'VITO_SETTING ' || name || '=' || setting FROM pg_settings WHERE name IN ('max_connections', 'max_worker_processes', 'max_wal_senders', 'max_prepared_transactions', 'max_locks_per_transaction')"
