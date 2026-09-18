<?php

return [
    'failover_enabled' => (bool) env('DATABASE_REPLICATION_FAILOVER_ENABLED', false),
    'network_types' => array_filter(explode(',', (string) env('DATABASE_REPLICATION_NETWORK_TYPES', 'provider,custom,wireguard'))),
    'lag_warning_mb' => (int) env('DATABASE_REPLICATION_LAG_WARNING_MB', 256),
    'lag_critical_mb' => (int) env('DATABASE_REPLICATION_LAG_CRITICAL_MB', 2048),
    'replay_lag_warning_seconds' => (int) env('DATABASE_REPLICATION_REPLAY_LAG_WARNING_SECONDS', 30),
    'replay_lag_critical_seconds' => (int) env('DATABASE_REPLICATION_REPLAY_LAG_CRITICAL_SECONDS', 300),
    'replay_delay_warning_seconds' => (int) env('DATABASE_REPLICATION_REPLAY_DELAY_WARNING_SECONDS', 300),
    'slot_retention_warning_percent' => (int) env('DATABASE_REPLICATION_SLOT_RETENTION_WARNING_PERCENT', 50),
    'metrics_retention_days' => (int) env('DATABASE_REPLICATION_METRICS_RETENTION_DAYS', 30),
    'seed_monitor_failures' => (int) env('DATABASE_REPLICATION_SEED_MONITOR_FAILURES', 30),
];
