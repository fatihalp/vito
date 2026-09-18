<?php

namespace App\Console\Commands;

use App\Enums\DatabaseReplicaStatus;
use App\Jobs\DatabaseReplica\CheckDatabaseReplicaJob;
use App\Models\DatabaseReplica;
use App\Models\DatabaseReplicaMetric;
use Illuminate\Console\Command;

class CheckDatabaseReplicasCommand extends Command
{
    protected $signature = 'database-replicas:check';

    protected $description = 'Check the health and lag of PostgreSQL replicas';

    public function handle(): void
    {
        $total = 0;

        DatabaseReplica::query()
            ->whereIn('status', [DatabaseReplicaStatus::READY, DatabaseReplicaStatus::NEEDS_REBUILD])
            ->whereHas('cluster.primary')
            ->whereHas('replica')
            ->chunkById(100, function ($replicas) use (&$total): void {
                foreach ($replicas as $replica) {
                    dispatch(new CheckDatabaseReplicaJob($replica))->onQueue('ssh');
                    $total++;
                }
            });

        DatabaseReplicaMetric::query()
            ->where('created_at', '<', now()->subDays((int) config('database-replication.metrics_retention_days')))
            ->delete();

        $this->info("{$total} replica checks queued");
    }
}
