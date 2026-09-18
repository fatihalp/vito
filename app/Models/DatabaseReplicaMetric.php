<?php

namespace App\Models;

use App\Enums\DatabaseReplicaHealth;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DatabaseReplicaMetric extends AbstractModel
{
    protected $fillable = [
        'database_replica_id',
        'health',
        'state',
        'lag_bytes',
        'replay_delay_seconds',
        'write_lag_ms',
        'flush_lag_ms',
        'replay_lag_ms',
        'slot_retained_bytes',
        'slot_wal_status',
    ];

    protected $casts = [
        'database_replica_id' => 'integer',
        'health' => DatabaseReplicaHealth::class,
        'lag_bytes' => 'integer',
        'replay_delay_seconds' => 'float',
        'write_lag_ms' => 'float',
        'flush_lag_ms' => 'float',
        'replay_lag_ms' => 'float',
        'slot_retained_bytes' => 'integer',
    ];

    public function databaseReplica(): BelongsTo
    {
        return $this->belongsTo(DatabaseReplica::class);
    }
}
