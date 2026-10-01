@foreach ($databases as $database)
sudo -u postgres psql -XtAq -d {!! escapeshellarg($database['name']) !!} -c "
    SELECT 'VITO_SUB|' || current_database()
        || '|' || (SELECT count(*) FROM pg_subscription_rel)
        || '|' || (SELECT count(*) FROM pg_subscription_rel WHERE srsubstate = 'r')
        || '|' || (SELECT count(*) FROM pg_stat_subscription WHERE pid IS NOT NULL)
        || '|' || CASE WHEN to_regclass('pg_catalog.pg_stat_subscription_stats') IS NULL THEN 0
                       ELSE (SELECT coalesce(sum(apply_error_count + sync_error_count), 0) FROM pg_stat_subscription_stats) END
        || '|' || coalesce((SELECT extract(epoch FROM (now() - max(latest_end_time)))::int FROM pg_stat_subscription), -1)" || true
@endforeach
