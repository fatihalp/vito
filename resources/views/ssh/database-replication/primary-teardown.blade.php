sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename = '{!! $username !!}'" > /dev/null
sleep 2
sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -c "SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots WHERE slot_name = '{!! $slot !!}' AND NOT active" > /dev/null
sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -c 'DROP ROLE IF EXISTS "{!! $username !!}"' > /dev/null

@include('ssh.database-replication.primary-access')
