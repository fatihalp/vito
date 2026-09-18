<?php

namespace App\Jobs\DatabaseReplica;

use App\Actions\DatabaseReplica\ManageDatabaseReplica;
use App\Models\DatabaseReplica;
use App\Models\ServerLog;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class DetachDatabaseReplicaJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public int $timeout = 600;

    public bool $deleteWhenMissingModels = true;

    public function __construct(protected DatabaseReplica $replica) {}

    public function handle(): void
    {
        $this->run("postgres-cluster-{$this->replica->postgres_cluster_id}", function (): void {
            app(ManageDatabaseReplica::class)->runDelete($this->replica->refresh());
        });
    }

    public function failed(Exception $e): void
    {
        $replica = DatabaseReplica::query()->find($this->replica->id);

        if ($replica) {
            ServerLog::log($replica->replica, 'database-replica-delete-failed', $e->getMessage());
            app(ManageDatabaseReplica::class)->fail($replica, __('Removing the replica failed: :error', ['error' => $e->getMessage()]));
        }
    }
}
