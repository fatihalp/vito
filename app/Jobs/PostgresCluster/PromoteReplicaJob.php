<?php

namespace App\Jobs\PostgresCluster;

use App\Actions\PostgresCluster\PromoteReplica;
use App\Models\PostgresCluster;
use App\Models\ServerLog;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class PromoteReplicaJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public int $timeout = 900;

    public function __construct(protected PostgresCluster $cluster) {}

    protected function lockSeconds(): int
    {
        return $this->timeout + 60;
    }

    public function handle(): void
    {
        $this->run("postgres-cluster-{$this->cluster->id}", function (): void {
            app(PromoteReplica::class)->run($this->cluster->refresh());
        });
    }

    public function failed(Throwable $e): void
    {
        $cluster = PostgresCluster::query()->find($this->cluster->id);

        if ($cluster === null) {
            return;
        }

        ServerLog::log($cluster->primary, 'postgres-failover-failed', $e->getMessage());
        app(PromoteReplica::class)->failed($cluster, $e);
    }
}
