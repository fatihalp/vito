@foreach ($databases as $database)
sudo -u postgres psql -X -q -d {!! escapeshellarg($database) !!} -v pub={!! escapeshellarg($publication) !!} -v user={!! escapeshellarg($username) !!} > /dev/null 2>&1 <<'VITO_SQL' || true
SET default_transaction_read_only = off;
DROP PUBLICATION IF EXISTS :"pub";
DROP OWNED BY :"user";
VITO_SQL
@endforeach

sudo -u postgres psql -X -q -v user={!! escapeshellarg($username) !!} > /dev/null 2>&1 <<'VITO_SQL' || true
SET default_transaction_read_only = off;
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = :'user';
VITO_SQL
sleep 2
sudo -u postgres psql -X -q -v prefix={!! escapeshellarg($slotPrefix.'%') !!} -v user={!! escapeshellarg($username) !!} > /dev/null 2>&1 <<'VITO_SQL' || true
SET default_transaction_read_only = off;
SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots WHERE slot_name LIKE :'prefix' AND NOT active;
DROP ROLE IF EXISTS :"user";
VITO_SQL
@if ($resetReadOnly)
sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 > /dev/null <<'VITO_SQL'
SET default_transaction_read_only = off;
ALTER SYSTEM RESET default_transaction_read_only;
VITO_SQL
@endif

@include('ssh.database-upgrade.source-access')

sudo rm -f "$CONF_DIR/zz-vito-upgrade.conf"
sudo -u postgres psql -XtAc 'SELECT pg_reload_conf()' > /dev/null
