<?php

return [

    

    'default' => env('QUEUE_CONNECTION', 'default'),

    

    'connections' => [

        'sync' => [
            'driver' => 'sync',
        ],

        'redis' => [
            'driver' => 'redis',
            'connection' => 'default',
            'queue' => env('REDIS_QUEUE', 'default'),
            'retry_after' => 600,
            'block_for' => null,
            'after_commit' => false,
        ],

        'default' => [
            'driver' => 'redis',
            'connection' => 'default',
            'queue' => 'default',
            'timeout' => 90,
            'retry_after' => 600,
            'block_for' => null,
            'after_commit' => false,
        ],

        'ssh' => [
            'driver' => 'redis',
            'connection' => 'default',
            'queue' => 'ssh',
            'timeout' => 1200,




            'retry_after' => max(300, (int) env('BACKUP_RUN_TIMEOUT', 3600)) + 60,
            'block_for' => null,
            'after_commit' => false,
        ],

        'storage-migration' => [
            'driver' => 'redis',
            'connection' => 'default',
            'queue' => 'storage-migration',
            'timeout' => 1800,
            'retry_after' => max(300, (int) env('STORAGE_MIGRATION_JOB_TIMEOUT', 1800)) + 60,
            'block_for' => null,
            'after_commit' => false,
        ],

        'storage-migration-scan' => [
            'driver' => 'redis',
            'connection' => 'default',
            'queue' => 'storage-migration-scan',
            'timeout' => 21600,
            'retry_after' => max(300, (int) env('STORAGE_MIGRATION_SCAN_TIMEOUT', 21600)) + 60,
            'block_for' => null,
            'after_commit' => false,
        ],

    ],

    

    'failed' => [
        'driver' => env('QUEUE_FAILED_DRIVER', 'database-uuids'),
        'database' => env('DB_CONNECTION', 'sqlite'),
        'table' => 'failed_jobs',
    ],

];
