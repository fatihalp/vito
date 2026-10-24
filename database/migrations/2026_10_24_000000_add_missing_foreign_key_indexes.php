<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @var array<string, list<string|list<string>>>
     */
    private const INDEXES = [
        'servers' => [['project_id', 'status']],
        'services' => [['server_id', 'type', 'is_default']],
        'server_logs' => [['server_id', 'is_remote', 'created_at'], 'site_id'],
        'deployments' => [['site_id', 'status'], ['site_id', 'created_at']],
        'backups' => ['server_id'],
        'backup_files' => [['backup_id', 'status'], 'server_id'],
        'ssls' => ['site_id', 'server_id', 'log_id', 'domain_id', 'expires_at'],
        'dns_records' => [['domain_id', 'type']],
        'git_hooks' => ['site_id'],
        'workers' => ['server_id', 'site_id'],
        'cron_jobs' => ['server_id', 'site_id'],
    ];

    public function up(): void
    {
        foreach (self::INDEXES as $table => $indexes) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($table, $indexes): void {
                foreach ($indexes as $columns) {
                    $columns = (array) $columns;

                    if (collect($columns)->every(fn (string $column): bool => Schema::hasColumn($table, $column))
                        && ! Schema::hasIndex($table, $this->name($table, $columns))) {
                        $blueprint->index($columns, $this->name($table, $columns));
                    }
                }
            });
        }
    }

    public function down(): void
    {
        foreach (self::INDEXES as $table => $indexes) {
            if (! Schema::hasTable($table)) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($table, $indexes): void {
                foreach ($indexes as $columns) {
                    $name = $this->name($table, (array) $columns);

                    if (Schema::hasIndex($table, $name)) {
                        $blueprint->dropIndex($name);
                    }
                }
            });
        }
    }

    /**
     * @param  list<string>  $columns
     */
    private function name(string $table, array $columns): string
    {
        return $table.'_'.implode('_', $columns).'_idx';
    }
};
