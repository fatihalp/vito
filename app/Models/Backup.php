<?php

namespace App\Models;

use App\Enums\BackupStatus;
use App\Enums\BackupType;
use Database\Factories\BackupFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;


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
    ];

    protected $casts = [
        'server_id' => 'integer',
        'storage_id' => 'integer',
        'database_id' => 'integer',
        'keep_backups' => 'integer',
        'type' => BackupType::class,
        'status' => BackupStatus::class,
        'enabled' => 'boolean',
    ];

    public static function boot(): void
    {
        parent::boot();

        static::deleting(function ($backup): void {
            
            $backup->files()->each(function ($file): void {
                
                $file->delete();
            });
        });
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
