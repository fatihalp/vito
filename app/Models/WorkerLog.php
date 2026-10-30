<?php

namespace App\Models;

use App\Enums\WorkerLogType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkerLog extends AbstractModel
{
    use HasFactory;

    protected $fillable = [
        'worker_id',
        'user_id',
        'type',
        'description',
    ];

    protected $casts = [
        'worker_id' => 'integer',
        'user_id' => 'integer',
        'type' => WorkerLogType::class,
    ];

    public function worker(): BelongsTo
    {
        return $this->belongsTo(Worker::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
