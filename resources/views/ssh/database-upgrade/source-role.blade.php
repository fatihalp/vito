SELECT format('CREATE ROLE %I WITH REPLICATION LOGIN', '{!! $username !!}') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{!! $username !!}') \gexec
ALTER ROLE "{!! $username !!}" WITH REPLICATION LOGIN PASSWORD '{!! $password !!}';
GRANT pg_read_all_data TO "{!! $username !!}";
@foreach ($databases as $database)
GRANT CONNECT ON DATABASE "{!! $database !!}" TO "{!! $username !!}";
@endforeach
