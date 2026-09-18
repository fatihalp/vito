<?php

namespace App\Models;

use App\Enums\BackupFileStatus;
use App\Enums\DatabaseReplicaStatus;
use App\Enums\NetworkServerStatus;
use App\Enums\PostgresClusterStatus;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;

class PostgresCluster extends AbstractModel
{
    protected $fillable = [
        'project_id',
        'primary_server_id',
        'backup_id',
        'network_id',
        'owns_network',
        'stanza',
        'tls',
        'status',
        'failover',
    ];

    protected $casts = [
        'project_id' => 'integer',
        'primary_server_id' => 'integer',
        'backup_id' => 'integer',
        'network_id' => 'integer',
        'owns_network' => 'boolean',
        'tls' => 'encrypted:json',
        'status' => PostgresClusterStatus::class,
        'failover' => 'array',
    ];

    protected $hidden = [
        'tls',
    ];

    protected static function booted(): void
    {
        static::deleting(function (PostgresCluster $cluster): void {
            $cluster->replicas()->each(fn (DatabaseReplica $replica) => $replica->delete());
        });
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function primary(): BelongsTo
    {
        return $this->belongsTo(Server::class, 'primary_server_id');
    }

    public function backup(): BelongsTo
    {
        return $this->belongsTo(Backup::class);
    }

    public function network(): BelongsTo
    {
        return $this->belongsTo(Network::class);
    }

    public function replicas(): HasMany
    {
        return $this->hasMany(DatabaseReplica::class);
    }

    /**
     * @return Collection<int, DatabaseReplica>
     */
    public function streamingReplicas(): Collection
    {
        return $this->replicas()
            ->whereNotIn('status', [DatabaseReplicaStatus::NEEDS_REBUILD, DatabaseReplicaStatus::DELETING, DatabaseReplicaStatus::WAITING_FOR_BACKUP, DatabaseReplicaStatus::PENDING])
            ->with('replica')
            ->get();
    }

    /**
     * @return Collection<int, Server>
     */
    public function nodes(): Collection
    {
        return collect([$this->primary])
            ->merge($this->replicas()->with('replica')->get()->pluck('replica'))
            ->filter()
            ->unique('id')
            ->values();
    }

    public function backupBusy(): bool
    {
        return $this->backup !== null
            && ($this->backup->files()->where('status', BackupFileStatus::CREATING)->exists() || isset($this->backup->configuration['verify']));
    }

    public function address(Server $server): ?string
    {
        $member = $this->network?->servers()
            ->where('server_id', $server->id)
            ->where('status', NetworkServerStatus::ACTIVE)
            ->first();

        return $member?->address();
    }

    public static function hostAlias(Server $server): string
    {
        return 'vito-pg-'.$server->id;
    }

    public static function forServer(Server $server): ?self
    {
        return self::query()
            ->where('primary_server_id', $server->id)
            ->orWhereHas('replicas', fn ($query) => $query->where('replica_server_id', $server->id))
            ->first();
    }
}
