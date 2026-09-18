<?php

namespace App\Actions\Backup;

use App\Enums\DatabaseReplicaHealth;
use App\Enums\DatabaseReplicaStatus;
use App\Models\DatabaseReplica;
use App\Models\PostgresCluster;
use App\Models\Server;

class SelectPgBackRestHost
{
    /**
     * Picks the healthiest, most caught-up replica that can take backups from standby, or the primary.
     */
    public function select(PostgresCluster $cluster): Server
    {
        if (! isset($cluster->tls['server_installed_at'])) {
            return $cluster->primary;
        }

        $lagLimit = config('database-replication.lag_warning_mb') * 1048576;

        $replica = $cluster->replicas()
            ->where('status', DatabaseReplicaStatus::READY)
            ->where('health', DatabaseReplicaHealth::HEALTHY)
            ->where('last_checked_at', '>=', now()->subMinutes(3))
            ->with(['replica', 'latestMetric'])
            ->get()
            ->filter(fn (DatabaseReplica $replica): bool => $replica->replica?->isReady() === true
                && isset($cluster->tls['nodes'][$replica->replica_server_id])
                && ($replica->latestMetric?->lag_bytes ?? PHP_INT_MAX) < $lagLimit)
            ->sortBy(fn (DatabaseReplica $replica): float => $replica->latestMetric?->replay_lag_ms ?? 0)
            ->first();

        return $replica?->replica ?? $cluster->primary;
    }
}
