<?php

namespace App\Models;

use App\Enums\StorageMigrationItemStatus;
use App\Enums\StorageMigrationStatus;
use App\Services\SupportsNetworking;
use Database\Factories\StorageMigrationFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Facades\DB;
use PDO;
use RuntimeException;

class StorageMigration extends AbstractModel
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'name',
        'project_id',
        'source_storage_id',
        'target_storage_id',
        'database_id',
        'database_user_id',
        'firewall_rule_id',
        'overwrite',
        'worker_count',
        'transfer_generation',
        'status',
        'items_total',
        'items_copied',
        'items_skipped',
        'items_failed',
        'bytes_total',
        'bytes_copied',
        'source_fingerprint',
        'target_fingerprint',
        'error',
        'started_at',
        'scan_completed_at',
        'scan_paused',
        'transfer_paused',
        'scan_cursor',
        'target_cursor',
        'target_scan_completed_at',
        'last_activity_at',
        'finished_at',
    ];

    protected $casts = [
        'project_id' => 'integer',
        'source_storage_id' => 'integer',
        'target_storage_id' => 'integer',
        'database_id' => 'integer',
        'database_user_id' => 'integer',
        'firewall_rule_id' => 'integer',
        'overwrite' => 'boolean',
        'worker_count' => 'integer',
        'transfer_generation' => 'integer',
        'scan_paused' => 'boolean',
        'transfer_paused' => 'boolean',
        'status' => StorageMigrationStatus::class,
        'items_total' => 'integer',
        'items_copied' => 'integer',
        'items_skipped' => 'integer',
        'items_failed' => 'integer',
        'bytes_total' => 'integer',
        'bytes_copied' => 'integer',
        'started_at' => 'datetime',
        'scan_completed_at' => 'datetime',
        'target_scan_completed_at' => 'datetime',
        'last_activity_at' => 'datetime',
        'finished_at' => 'datetime',
    ];

    public function isSettled(): bool
    {
        return ! $this->status->isOpen();
    }

    public function isSyncing(): bool
    {
        return $this->status->isActive()
            && $this->last_activity_at?->gte(now()->subSeconds((int) config('storage-migration.activity_window', 120))) === true;
    }

    public function progress(): float
    {
        return $this->items_total > 0
            ? min(100, ($this->items_copied + $this->items_skipped + $this->items_failed) / $this->items_total * 100)
            : 0;
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(StorageProvider::class, 'source_storage_id');
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(StorageProvider::class, 'target_storage_id');
    }

    public function database(): BelongsTo
    {
        return $this->belongsTo(Database::class);
    }

    public function databaseUser(): BelongsTo
    {
        return $this->belongsTo(DatabaseUser::class);
    }

    public function firewallRule(): BelongsTo
    {
        return $this->belongsTo(FirewallRule::class);
    }

    public function itemsTable(): string
    {
        return 'storage_migration_items_'.$this->id;
    }

    public function itemsConnection(): string
    {
        if ($this->database_id === null) {
            return $this->getConnectionName() ?? (string) config('database.default');
        }

        $name = 'storage-migration-'.$this->id;

        if (config("database.connections.{$name}") !== null) {
            return $name;
        }

        $server = $this->database?->server;
        $service = $server?->database();
        $handler = $service?->handler();

        if (! $handler instanceof SupportsNetworking || ! $this->databaseUser) {
            throw new RuntimeException(__('The scan database of this storage migration is no longer available.'));
        }

        $driver = $service->name === 'postgresql' ? 'pgsql' : 'mysql';

        config(["database.connections.{$name}" => [
            ...config("database.connections.{$driver}"),
            'url' => null,
            'unix_socket' => '',
            'host' => $server->is_self ? '127.0.0.1' : $server->ip,
            'port' => $handler->networkingPort(),
            'database' => $this->database->name,
            'username' => $this->databaseUser->username,
            'password' => $this->databaseUser->password,
            'options' => [PDO::ATTR_TIMEOUT => 5],
        ]]);

        return $name;
    }

    public function targetsTable(): string
    {
        return 'storage_migration_targets_'.$this->id;
    }

    /**
     * Objects that already existed on the target when the migration listed it, keyed by the sha1 of their key.
     */
    public function targets(): QueryBuilder
    {
        return DB::connection($this->itemsConnection())->table($this->targetsTable());
    }

    public function items(): Builder
    {
        return (new StorageMigrationItem)
            ->setConnection($this->itemsConnection())
            ->setTable($this->itemsTable())
            ->newQuery();
    }

    public function withProcessingCount(): static
    {
        return $this->setAttribute('items_processing', $this->started_at === null ? 0 : rescue(
            fn (): int => $this->items()->where('status', StorageMigrationItemStatus::PROCESSING)->count(),
            0,
            false,
        ));
    }
}
