estimate_database_size() {
if ! sudo -u postgres env PGCONNECT_TIMEOUT=3 PGOPTIONS='-c statement_timeout=2000 -c lock_timeout=500' psql -X -qAt -v ON_ERROR_STOP=1 -d "$1" <<'SQL'
SELECT json_build_object(current_database(), coalesce(sum(relpages::bigint), 0) * current_setting('block_size')::bigint)
FROM pg_class
WHERE relkind IN ('r', 'm', 'i', 't', 'S') AND relisshared = false;
SQL
then
    echo 'VITO_SSH_ERROR' && exit 1
fi
}

@foreach ($databases as $database)
estimate_database_size {!! escapeshellarg("dbname='".str_replace(['\\', "'"], ['\\\\', "\\'"], $database)."'") !!}
@endforeach
