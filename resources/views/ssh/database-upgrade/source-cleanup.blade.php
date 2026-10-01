@foreach ($databases as $database)
sudo -u postgres psql -X -q -d {!! escapeshellarg($database) !!} -c "DROP PUBLICATION IF EXISTS :\"pub\"" -v pub={!! escapeshellarg($publication) !!} > /dev/null 2>&1 || true
sudo -u postgres psql -X -q -d {!! escapeshellarg($database) !!} -c "DROP OWNED BY :\"user\"" -v user={!! escapeshellarg($username) !!} > /dev/null 2>&1 || true
@endforeach

sudo -u postgres psql -X -q -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = :'user'" -v user={!! escapeshellarg($username) !!} > /dev/null 2>&1 || true
sleep 2
sudo -u postgres psql -X -q -c "SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots WHERE slot_name LIKE :'prefix' AND NOT active" -v prefix={!! escapeshellarg($slotPrefix.'%') !!} > /dev/null 2>&1 || true
sudo -u postgres psql -X -q -c "DROP ROLE IF EXISTS :\"user\"" -v user={!! escapeshellarg($username) !!} > /dev/null 2>&1 || true
@if ($resetReadOnly)
sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -c "ALTER SYSTEM RESET default_transaction_read_only" > /dev/null
@endif

@include('ssh.database-upgrade.source-access')

sudo rm -f "$CONF_DIR/zz-vito-upgrade.conf"
sudo -u postgres psql -XtAc 'SELECT pg_reload_conf()' > /dev/null
