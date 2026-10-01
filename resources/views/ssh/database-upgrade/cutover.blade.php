sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -c "ALTER SYSTEM SET default_transaction_read_only = on" > /dev/null
sudo -u postgres psql -XtAc 'SELECT pg_reload_conf()' > /dev/null

sudo -u postgres psql -X -q -v user={!! escapeshellarg($username) !!} > /dev/null <<'VITO_SQL'
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE pid <> pg_backend_pid() AND backend_type = 'client backend' AND datname IS NOT NULL
    AND usename IS DISTINCT FROM :'user' AND usename IS DISTINCT FROM 'postgres';
VITO_SQL

TARGET_LSN=$(sudo -u postgres psql -XtAc 'SELECT pg_current_wal_lsn()')
REMAINING=-1

for ATTEMPT in $(seq 1 {{ (int) $attempts }}); do
    REMAINING=$(sudo -u postgres psql -XtAq -v prefix={!! escapeshellarg($slotPrefix.'%') !!} -v lsn="$TARGET_LSN" <<'VITO_SQL'
SELECT count(*) FROM pg_replication_slots
WHERE slot_name LIKE :'prefix' AND (confirmed_flush_lsn IS NULL OR confirmed_flush_lsn < :'lsn'::pg_lsn);
VITO_SQL
)
    [ "$REMAINING" = "0" ] && break
    sleep 2
done

echo "VITO_LSN=$TARGET_LSN"
echo "VITO_REMAINING=$REMAINING"
echo "VITO_SLOTS=$(sudo -u postgres psql -XtAq -v prefix={!! escapeshellarg($slotPrefix.'%') !!} <<'VITO_SQL'
SELECT count(*) FROM pg_replication_slots WHERE slot_name LIKE :'prefix';
VITO_SQL
)"
