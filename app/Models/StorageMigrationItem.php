<?php

namespace App\Models;

use App\Enums\StorageMigrationItemStatus;
use Database\Factories\StorageMigrationItemFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class StorageMigrationItem extends AbstractModel
{
    use HasFactory;

    protected $fillable = [
        'backup_file_id',
        'source_key',
        'source_key_hash',
        'target_key',
        'size',
        'copied_bytes',
        'checksum',
        'status',
        'attempts',
        'error',
        'worker_slot',
    ];

    protected $casts = [
        'backup_file_id' => 'integer',
        'size' => 'integer',
        'copied_bytes' => 'integer',
        'status' => StorageMigrationItemStatus::class,
        'attempts' => 'integer',
        'worker_slot' => 'integer',
    ];
}
