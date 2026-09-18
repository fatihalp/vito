<?php

namespace App\Models;

use App\Enums\BackupStatus;
use App\Enums\BackupType;
use App\SSH\PgBackRest;
use Cron\CronExpression;
use Database\Factories\BackupFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

class Backup extends AbstractModel
{
    
    use HasFactory;

    protected $fillable = [
        'type',
        'server_id',
        'storage_id',
        'database_id',
        'path',
        'interval',
        'keep_backups',
        'status',
        'configuration',
        'health',
    ];

    protected $casts = [
        'server_id' => 'integer',
        'storage_id' => 'integer',
        'database_id' => 'integer',
        'keep_backups' => 'integer',
        'type' => BackupType::class,
        'status' => BackupStatus::class,
        'enabled' => 'boolean',
        'configuration' => 'encrypted:json',
        'health' => 'array',
    ];

    protected $hidden = [
        'configuration',
    ];

    public static function boot(): void
    {
        parent::boot();

        static::deleting(function ($backup): void {
            
            $backup->files()->each(function ($file): void {
                
                $file->delete();
            });
            $backup->restores()->delete();
        });
    }

    public function restores(): HasMany
    {
        return $this->hasMany(BackupRestore::class);
    }

    public function cluster(): HasOne
    {
        return $this->hasOne(PostgresCluster::class, 'backup_id');
    }

    public function pgBackRest(): PgBackRest
    {
        return new PgBackRest($this);
    }

    /**
     * The latest time the cron expression was due at or before $at, or null for an invalid or impossible expression such as 30 February.
     */
    public static function lastDue(?string $expression, Carbon $at): ?Carbon
    {
        if ($expression === null || ! CronExpression::isValidExpression($expression)) {
            return null;
        }

        return rescue(fn (): Carbon => Carbon::instance((new CronExpression($expression))->getPreviousRunDate($at, 0, true, config('app.timezone'))), null, false);
    }

    public function target(): ?string
    {
        return match ($this->type) {
            BackupType::FILE => $this->path,
            BackupType::DATABASE => $this->database?->name,
            BackupType::PGBACKREST => __('PostgreSQL cluster'),
        };
    }

    public function isCustomInterval(): bool
    {
        $intervals = array_keys(config('core.cronjob_intervals'));
        $intervals = array_filter($intervals, fn ($interval): bool => $interval !== 'custom');

        return ! in_array($this->interval, $intervals);
    }

    
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    
    public function storage(): BelongsTo
    {
        return $this->belongsTo(StorageProvider::class, 'storage_id');
    }

    
    public function database(): BelongsTo
    {
        return $this->belongsTo(Database::class)->withTrashed();
    }

    
    public function files(): HasMany
    {
        return $this->hasMany(BackupFile::class, 'backup_id');
    }

    
    public function lastFile(): HasOne
    {
        return $this->hasOne(BackupFile::class, 'backup_id')->latest();
    }
}
