<?php

return [
    'queue' => 'storage-migration',
    'scan_queue' => 'storage-migration-scan',
    'batch_size' => (int) env('STORAGE_MIGRATION_BATCH_SIZE', 25),
    'list_page_size' => (int) env('STORAGE_MIGRATION_LIST_PAGE_SIZE', 1000),
    'multipart_threshold' => (int) env('STORAGE_MIGRATION_MULTIPART_THRESHOLD', 16 * 1024 * 1024),
    'part_size' => (int) env('STORAGE_MIGRATION_PART_SIZE', 16 * 1024 * 1024),
    'max_attempts' => (int) env('STORAGE_MIGRATION_MAX_ATTEMPTS', 3),
    'max_verify_passes' => 2,
    'job_timeout' => (int) env('STORAGE_MIGRATION_JOB_TIMEOUT', 1800),
    'scan_timeout' => (int) env('STORAGE_MIGRATION_SCAN_TIMEOUT', 21600),
    'scan_wait_delay' => (int) env('STORAGE_MIGRATION_SCAN_WAIT_DELAY', 5),
    'activity_window' => (int) env('STORAGE_MIGRATION_ACTIVITY_WINDOW', 120),
    'default_max_processes' => (int) env('HORIZON_STORAGE_MIGRATION_MAX_PROCESSES', 1),
    'default_scan_max_processes' => (int) env('HORIZON_STORAGE_MIGRATION_SCAN_MAX_PROCESSES', 1),
    'max_allowed_processes' => 10,
];
