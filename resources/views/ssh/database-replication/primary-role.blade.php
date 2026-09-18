SELECT format('CREATE ROLE %I WITH REPLICATION LOGIN', '{!! $username !!}') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{!! $username !!}') \gexec
ALTER ROLE "{!! $username !!}" WITH REPLICATION LOGIN PASSWORD '{!! $password !!}';
SELECT pg_create_physical_replication_slot('{!! $slot !!}', true) WHERE NOT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = '{!! $slot !!}');
