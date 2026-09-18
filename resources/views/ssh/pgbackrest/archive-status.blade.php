echo "VITO_ARCHIVER=$(sudo -u postgres psql -tAc "SELECT coalesce(extract(epoch FROM last_archived_time)::bigint, 0) || ' ' || coalesce(extract(epoch FROM last_failed_time)::bigint, 0) FROM pg_stat_archiver")"
echo "VITO_DROPPED=$(sudo sh -c {!! escapeshellarg('cat /var/log/pgbackrest/'.$stanza.'-archive-push*.log 2>/dev/null') !!} | grep -c 'dropped WAL file' || true)"
