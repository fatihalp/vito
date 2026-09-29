if ! sudo -u postgres pg_isready -q; then
    echo "VITO_SSH_ERROR: PostgreSQL is not running on this server"
    exit 1
fi

PSQL="sudo -u postgres psql -XtAq -v ON_ERROR_STOP=1"

echo "VITO_VERSION_NUM=$($PSQL -c 'SHOW server_version_num')"
echo "VITO_IN_RECOVERY=$($PSQL -c 'SELECT pg_is_in_recovery()')"
echo "VITO_WAL_LEVEL=$($PSQL -c 'SHOW wal_level')"
echo "VITO_MAX_REPLICATION_SLOTS=$($PSQL -c 'SHOW max_replication_slots')"
echo "VITO_USED_SLOTS=$($PSQL -c 'SELECT count(*) FROM pg_replication_slots')"
echo "VITO_MAX_WAL_SENDERS=$($PSQL -c 'SHOW max_wal_senders')"
echo "VITO_USED_SENDERS=$($PSQL -c 'SELECT count(*) FROM pg_stat_replication')"
echo "VITO_READ_ONLY=$($PSQL -c 'SHOW default_transaction_read_only')"
echo "VITO_PORT=$($PSQL -c 'SHOW port')"
echo "VITO_SSL=$($PSQL -c 'SHOW ssl')"

for DB in $($PSQL -c "SELECT datname FROM pg_database WHERE datallowconn AND NOT datistemplate AND datname <> 'postgres' ORDER BY datname"); do
    $PSQL -d "$DB" -c "
        SELECT 'VITO_DB|' || current_database()
            || '|' || pg_database_size(current_database())
            || '|' || (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND c.relpersistence = 'p' AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\_toast%')
            || '|' || (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND c.relpersistence = 'p' AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\_toast%' AND (c.relreplident = 'n' OR (c.relreplident = 'd' AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.oid AND i.indisprimary))))
            || '|' || (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'r' AND c.relpersistence = 'u' AND n.nspname NOT IN ('pg_catalog', 'information_schema'))
            || '|' || (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind = 'm' AND n.nspname NOT IN ('pg_catalog', 'information_schema'))
            || '|' || (SELECT count(*) FROM pg_largeobject_metadata)
            || '|' || (SELECT coalesce(string_agg(extname, ' ' ORDER BY extname), '') FROM pg_extension WHERE extname <> 'plpgsql')"

    $PSQL -d "$DB" -c "
        SELECT 'VITO_NOPK|' || current_database() || '|' || n.nspname || '.' || c.relname
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r' AND c.relpersistence = 'p' AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\_toast%'
            AND (c.relreplident = 'n' OR (c.relreplident = 'd' AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.oid AND i.indisprimary)))
        ORDER BY 1 LIMIT 5"
done
