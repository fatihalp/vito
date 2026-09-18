<?php

namespace App\Jobs\DatabaseReplica;

use App\Actions\DatabaseReplica\ManageDatabaseReplica;
use App\Enums\DatabaseReplicaStatus;
use App\Enums\PostgresClusterStatus;
use App\Models\DatabaseReplica;
use App\Models\ServerLog;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SetupDatabaseReplicaJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public int $timeout = 600;

    public bool $deleteWhenMissingModels = true;

    public function __construct(protected DatabaseReplica $replica, protected int $waits = 0) {}

    public function handle(): void
    {
        $this->run("postgres-cluster-{$this->replica->postgres_cluster_id}", function (): void {
            $this->replica->refresh();

            if (! in_array($this->replica->status, [DatabaseReplicaStatus::PENDING, DatabaseReplicaStatus::CONFIGURING], true)) {
                return;
            }

            if ($this->replica->cluster->status !== PostgresClusterStatus::ACTIVE || $this->replica->cluster->backupBusy()) {
                dispatch(new self($this->replica, $this->waits))->onQueue('ssh')->delay(now()->addMinute());

                return;
            }

            if (app(ManageDatabaseReplica::class)->setup($this->replica)) {
                return;
            }

            if ($this->waits >= 120) {
                app(ManageDatabaseReplica::class)->fail($this->replica, __('The primary did not open PostgreSQL to the replica within 30 minutes. Check its networking and firewall.'));

                return;
            }

            dispatch(new self($this->replica, $this->waits + 1))->onQueue('ssh')->delay(now()->addSeconds(15));
        });
    }

    public function failed(Exception $e): void
    {
        $replica = DatabaseReplica::query()->find($this->replica->id);

        if ($replica) {
            $step = $replica->configuration['setup_step'] ?? null;
            $message = $step !== null
                ? __('Setup failed while :step: :error. Open the logs on the replica page for the full output.', ['step' => $step, 'error' => $e->getMessage()])
                : $e->getMessage();

            ServerLog::log($replica->replica, 'database-replica-setup-failed', $message);
            rescue(fn () => $replica->replication()->dropInactiveSlot(), report: false);
            app(ManageDatabaseReplica::class)->fail($replica, $message);
        }
    }
}
