sudo -u postgres psql -XtAq -v prefix={!! escapeshellarg($slotPrefix.'%') !!} <<'VITO_SQL' || true
SELECT 'VITO_SLOT|' || slot_name || '|' || active || '|' || coalesce(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)::bigint::text, '0') || '|' || coalesce(wal_status, '')
FROM pg_replication_slots WHERE slot_name LIKE :'prefix';
VITO_SQL
echo "VITO_READ_ONLY=$(sudo -u postgres psql -XtAc 'SHOW default_transaction_read_only')"
