<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const array TABLES = [
        'servers',
        'server_providers',
        'storage_providers',
        'users',
        'domains',
        'hosted_domains',
        'dns_records',
        'notification_channels',
        'cron_jobs',
        'workers',
        'firewall_rules',
        'database_users',
        'redirects',
        'backups',
        'backup_files',
        'networks',
        'network_peers',
        'network_servers',
        'services',
        'ssls',
        'commands',
        'database_replicas',
        'postgres_clusters',
    ];

    public function up(): void
    {
        foreach (self::TABLES as $tableName) {
            if (Schema::hasTable($tableName) && ! Schema::hasColumn($tableName, 'deleted_at')) {
                Schema::table($tableName, function (Blueprint $table): void {
                    $table->softDeletes();
                });
            }
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $tableName) {
            if (Schema::hasTable($tableName) && Schema::hasColumn($tableName, 'deleted_at')) {
                Schema::table($tableName, function (Blueprint $table): void {
                    $table->dropSoftDeletes();
                });
            }
        }
    }
};
