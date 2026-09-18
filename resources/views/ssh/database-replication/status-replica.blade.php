if ! sudo -u postgres pg_isready -q; then
    echo "VITO_REPLICA_DOWN"
    exit 0
fi

sudo -u postgres psql -XAt -F'|' -c "SELECT 'VITO_REPLICA', pg_is_in_recovery(), coalesce((SELECT status FROM pg_stat_wal_receiver), ''), coalesce(pg_wal_lsn_diff(pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn()), 0)::bigint, coalesce(extract(epoch FROM now() - pg_last_xact_replay_timestamp())::text, '')"
