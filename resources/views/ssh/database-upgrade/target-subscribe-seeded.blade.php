@foreach ($databases as $database)
HAS_SUB=$(sudo -u postgres psql -XtAq -d {!! escapeshellarg($database['name']) !!} -v sub={!! escapeshellarg($database['subscription']) !!} <<'VITO_SQL'
SELECT 1 FROM pg_subscription WHERE subname = :'sub';
VITO_SQL
)

if [ "$HAS_SUB" != "1" ]; then
    {{-- copy_data = false: the rows are already here from the backup. The origin tells the apply worker where that
         copy ended, so the old server's changes from that point on arrive exactly once. --}}
    sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -d {!! escapeshellarg($database['name']) !!} \
        -v sub={!! escapeshellarg($database['subscription']) !!} \
        -v conn={!! escapeshellarg($database['conninfo']) !!} \
        -v pub={!! escapeshellarg($publication) !!} \
        -v slot={!! escapeshellarg($database['slot']) !!} \
        -v lsn={!! escapeshellarg($database['lsn']) !!} > /dev/null <<'VITO_SQL'
CREATE SUBSCRIPTION :"sub" CONNECTION :'conn' PUBLICATION :"pub"
    WITH (copy_data = false, create_slot = false, slot_name = :'slot', enabled = false);
SELECT pg_replication_origin_advance('pg_' || (SELECT oid FROM pg_subscription WHERE subname = :'sub')::text, :'lsn'::pg_lsn);
ALTER SUBSCRIPTION :"sub" ENABLE;
VITO_SQL
    echo "{{ $database['name'] }} is following the old server from {{ $database['lsn'] }}"
else
    echo "{{ $database['name'] }} is already following the old server"
fi
@endforeach
