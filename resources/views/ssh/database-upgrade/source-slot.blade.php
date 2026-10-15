@foreach ($databases as $database)
HAS_SLOT=$(sudo -u postgres psql -XtAq -v ON_ERROR_STOP=1 -d {!! escapeshellarg($database['name']) !!} -v slot={!! escapeshellarg($database['slot']) !!} <<'VITO_SQL'
SELECT 1 FROM pg_replication_slots WHERE slot_name = :'slot';
VITO_SQL
)

if [ "$HAS_SLOT" = "1" ]; then
    LSN=$(sudo -u postgres psql -XtAq -v ON_ERROR_STOP=1 -d {!! escapeshellarg($database['name']) !!} -v slot={!! escapeshellarg($database['slot']) !!} <<'VITO_SQL'
SELECT coalesce(confirmed_flush_lsn, restart_lsn) FROM pg_replication_slots WHERE slot_name = :'slot';
VITO_SQL
)
else
    LSN=$(sudo -u postgres psql -XtAq -v ON_ERROR_STOP=1 -d {!! escapeshellarg($database['name']) !!} -v slot={!! escapeshellarg($database['slot']) !!} <<'VITO_SQL'
SELECT lsn FROM pg_create_logical_replication_slot(:'slot', 'pgoutput');
VITO_SQL
)
fi

echo "VITO_LSN|{{ $database['name'] }}|$LSN"
@endforeach

sudo -u postgres psql -XtAc 'SELECT pg_switch_wal()' > /dev/null
sudo -u postgres psql -XtAc 'CHECKPOINT' > /dev/null
