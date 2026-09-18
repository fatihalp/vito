<?php

namespace App\Jobs\DatabaseReplica;

use App\Actions\DatabaseReplica\CheckDatabaseReplicaHealth;
use App\Enums\DatabaseReplicaStatus;
use App\Models\DatabaseReplica;
use App\Models\ServerLog;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class CheckDatabaseReplicaJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public int $timeout = 120;

    public bool $deleteWhenMissingModels = true;

    public function __construct(protected DatabaseReplica $replica) {}

    public function handle(): void
    {
        $this->run("database-replica-check-{$this->replica->id}", function (): void {
            $this->replica->refresh();

            if ($this->replica->status === DatabaseReplicaStatus::READY) {
                app(CheckDatabaseReplicaHealth::class)->check($this->replica);
            }

            if ($this->replica->status === DatabaseReplicaStatus::NEEDS_REBUILD) {
                app(CheckDatabaseReplicaHealth::class)->fenceOnSight($this->replica);
            }
        });
    }

    public function failed(Exception $e): void
    {
        ServerLog::log($this->replica->primary, 'database-replica-check-failed', $e->getMessage());
    }
}
