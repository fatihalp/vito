<?php

namespace App\Models;

use App\Enums\DatabaseUpgradeStatus;
use App\Enums\NetworkServerStatus;
use App\SSH\PostgresLogicalReplication;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DatabaseUpgrade extends AbstractModel
{
    protected $fillable = [
        'project_id',
        'source_server_id',
        'target_server_id',
        'network_id',
        'owns_network',
        'mode',
        'source_version',
        'target_version',
        'username',
        'password',
        'status',
        'step',
        'message',
        'preflight',
        'configuration',
        'events',
        'caught_up_at',
        'finished_at',
    ];

    protected $casts = [
        'project_id' => 'integer',
        'source_server_id' => 'integer',
        'target_server_id' => 'integer',
        'network_id' => 'integer',
        'owns_network' => 'boolean',
        'password' => 'encrypted',
        'status' => DatabaseUpgradeStatus::class,
        'preflight' => 'array',
        'configuration' => 'array',
        'events' => 'array',
        'caught_up_at' => 'datetime',
        'finished_at' => 'datetime',
    ];

    protected $hidden = [
        'password',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(Server::class, 'source_server_id');
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(Server::class, 'target_server_id');
    }

    public function network(): BelongsTo
    {
        return $this->belongsTo(Network::class);
    }

    public function replication(): PostgresLogicalReplication
    {
        return new PostgresLogicalReplication($this);
    }

    /**
     * A seeded upgrade starts the new server from a physical backup and replicates only what happened since, instead
     * of copying every row over the wire.
     */
    public function seeded(): bool
    {
        return $this->mode === 'seeded';
    }

    /**
     * Keeps a line of what Vito did, so a step that waits can say what it is waiting for. Bounded: an upgrade that waits
     * for days must not grow without end.
     */
    public function record(string $message, string $level = 'info'): void
    {
        $events = $this->events ?? [];
        $last = end($events);

        if (is_array($last) && ($last['message'] ?? null) === $message) {
            return;
        }

        $events[] = ['at' => now()->toIso8601String(), 'level' => $level, 'message' => $message];

        $this->update(['events' => array_slice($events, -200)]);
    }

    /**
     * The databases being copied, in the order they were found on the source.
     *
     * @return list<array{name: string, size: int, tables: int}>
     */
    public function databases(): array
    {
        return array_values($this->preflight['databases'] ?? []);
    }

    /**
     * The subscription and replication slot Vito uses for one database. PostgreSQL allows 63 characters.
     */
    public function subscriptionName(string $database): string
    {
        $index = array_search($database, array_column($this->databases(), 'name'), true);

        return 'vito_upgrade_'.$this->id.'_'.($index === false ? 0 : $index);
    }

    /**
     * Share of the tables whose first copy finished, once the copy started.
     */
    public function progress(): ?float
    {
        $tables = (int) ($this->configuration['tables'] ?? 0);
        $copied = $this->configuration['copied'] ?? null;

        return $tables > 0 && $copied !== null ? round(min((int) $copied, $tables) / $tables * 100, 1) : null;
    }

    /**
     * The private address a server has on the network the copy runs over.
     */
    public function address(Server $server): ?string
    {
        return $this->network?->servers()
            ->where('server_id', $server->id)
            ->where('status', NetworkServerStatus::ACTIVE)
            ->first()
            ?->address();
    }

    /**
     * The upgrade a server takes part in, whether it is the old or the new server.
     */
    public static function forServer(Server $server, bool $activeOnly = true): ?self
    {
        return self::query()
            ->where(fn (Builder $query) => $query->where('source_server_id', $server->id)->orWhere('target_server_id', $server->id))
            ->when($activeOnly, fn (Builder $query) => $query->whereIn('status', array_map(
                fn (DatabaseUpgradeStatus $status): string => $status->value,
                array_filter(DatabaseUpgradeStatus::cases(), fn (DatabaseUpgradeStatus $status): bool => $status->isActive()),
            )))
            ->latest('id')
            ->first();
    }
}
