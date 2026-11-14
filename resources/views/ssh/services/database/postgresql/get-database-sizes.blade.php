if ! sudo -u postgres psql -X -qAt -v ON_ERROR_STOP=1 -d postgres <<'SQL'
SET statement_timeout = '90s';
SELECT coalesce(json_object_agg(datname, pg_database_size(oid)), '{}'::json)
FROM pg_database
WHERE datname NOT IN ('template0', 'template1', 'postgres');
SQL
then
    echo 'VITO_SSH_ERROR' && exit 1
fi
