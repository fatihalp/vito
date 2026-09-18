<?php

namespace App\Models;

use App\Enums\DatabaseReplicaHealth;
use App\Enums\DatabaseReplicaStatus;
use App\SSH\PostgresReplication;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class DatabaseReplica extends AbstractModel
{
    protected $fillable = [
        'postgres_cluster_id',
        'replica_server_id',
        'status',
        'health',
        'health_reasons',
        'slot_name',
        'username',
        'password',
        'max_slot_wal_keep_size_gb',
        'configuration',
        'progress',
        'message',
        'last_checked_at',
    ];

    protected $casts = [
        'postgres_cluster_id' => 'integer',
        'replica_server_id' => 'integer',
        'status' => DatabaseReplicaStatus::class,
        'health' => DatabaseReplicaHealth::class,
        'health_reasons' => 'array',
        'password' => 'encrypted',
        'max_slot_wal_keep_size_gb' => 'integer',
        'configuration' => 'json',
        'progress' => 'float',
        'last_checked_at' => 'datetime',
    ];

    protected $hidden = [
        'password',
    ];

    protected static function booted(): void
    {
        static::deleting(function (DatabaseReplica $replica): void {
            $replica->metrics()->delete();
        });
    }

    public function cluster(): BelongsTo
    {
        return $this->belongsTo(PostgresCluster::class, 'postgres_cluster_id');
    }

    public function replica(): BelongsTo
    {
        return $this->belongsTo(Server::class, 'replica_server_id');
    }

    public function getPrimaryAttribute(): Server
    {
        return $this->cluster->primary;
    }

    public function metrics(): HasMany
    {
        return $this->hasMany(DatabaseReplicaMetric::class);
    }

    public function latestMetric(): HasOne
    {
        return $this->hasOne(DatabaseReplicaMetric::class)->latestOfMany();
    }

    public function applicationName(): string
    {
        return 'vito_replica_'.$this->id;
    }

    public function replication(): PostgresReplication
    {
        return new PostgresReplication($this);
    }
}
