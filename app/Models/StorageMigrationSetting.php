<?php

namespace App\Models;

class StorageMigrationSetting extends AbstractModel
{
    protected $fillable = [
        'max_processes',
        'scan_max_processes',
        'applied_max_processes',
        'applied_scan_max_processes',
        'applied_at',
    ];

    protected $casts = [
        'max_processes' => 'integer',
        'scan_max_processes' => 'integer',
        'applied_max_processes' => 'integer',
        'applied_scan_max_processes' => 'integer',
        'applied_at' => 'datetime',
    ];

    public static function current(): self
    {
        return static::query()->firstOrCreate([], [
            'max_processes' => (int) config('storage-migration.default_max_processes', 1),
            'scan_max_processes' => (int) config('storage-migration.default_scan_max_processes', 1),
        ]);
    }

    public function needsApply(): bool
    {
        return $this->max_processes !== $this->applied_max_processes
            || $this->scan_max_processes !== $this->applied_scan_max_processes;
    }
}
