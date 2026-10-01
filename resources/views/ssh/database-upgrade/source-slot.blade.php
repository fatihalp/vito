@foreach ($databases as $database)
HAS_SLOT=$(sudo -u postgres psql -XtAq -v ON_ERROR_STOP=1 -d {!! escapeshellarg($database['name']) !!} -v slot={!! escapeshellarg($database['slot']) !!} <<'VITO_SQL'
SELECT 1 FROM pg_replication_slots WHERE slot_name = :'slot';
VITO_SQL
)

if [ "$HAS_SLOT" = "1" ]; then
    LSN=$(sudo -u postgres psql -XtAq -v ON_ERROR_STOP=1 -d {!! escapeshellarg($database['name']) !!} -v slot={!! escapeshellarg($database['slot']) !!} <<'VITO_SQL'
SELECT confirmed_flush_lsn FROM pg_replication_slots WHERE slot_name = :'slot';
VITO_SQL
)
else
    {{-- The slot is created before the backup is restored, so the old server keeps every change from this point on. --}}
    LSN=$(sudo -u postgres psql -XtAq -v ON_ERROR_STOP=1 -d {!! escapeshellarg($database['name']) !!} -v slot={!! escapeshellarg($database['slot']) !!} <<'VITO_SQL'
SELECT lsn FROM pg_create_logical_replication_slot(:'slot', 'pgoutput');
VITO_SQL
)
fi

echo "VITO_LSN|{{ $database['name'] }}|$LSN"
@endforeach

{{-- So the segment holding those positions reaches the repository, and the restore can replay up to them. --}}
sudo -u postgres psql -XtAc 'SELECT pg_switch_wal()' > /dev/null
sudo -u postgres psql -XtAc 'CHECKPOINT' > /dev/null
