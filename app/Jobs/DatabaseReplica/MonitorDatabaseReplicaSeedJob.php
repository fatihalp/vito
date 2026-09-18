<?php

namespace App\Jobs\DatabaseReplica;

use App\Actions\DatabaseReplica\ManageDatabaseReplica;
use App\Enums\DatabaseReplicaStatus;
use App\Exceptions\SSHError;
use App\Models\DatabaseReplica;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class MonitorDatabaseReplicaSeedJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public bool $deleteWhenMissingModels = true;

    public function __construct(protected DatabaseReplica $replica, protected int $errors = 0) {}

    public function handle(): void
    {
        $this->run("database-replica-seed-{$this->replica->id}", function (): void {
            $this->replica->refresh();

            if ($this->replica->status !== DatabaseReplicaStatus::SEEDING) {
                return;
            }

            try {
                $finished = app(ManageDatabaseReplica::class)->monitorSeed($this->replica);
            } catch (SSHError $e) {
                if ($this->errors >= config('database-replication.seed_monitor_failures')) {
                    app(ManageDatabaseReplica::class)->fail($this->replica, __('Vito could not reach the replica server to check the seed: :error', ['error' => $e->getMessage()]));

                    return;
                }

                $this->next($this->errors + 1);

                return;
            }

            if (! $finished) {
                $this->next(0);
            }
        });
    }

    public function failed(Exception $e): void
    {
        $replica = DatabaseReplica::query()->find($this->replica->id);

        if ($replica?->status === DatabaseReplicaStatus::SEEDING) {
            app(ManageDatabaseReplica::class)->fail($replica, $e->getMessage());
        }
    }

    private function next(int $errors): void
    {
        dispatch(new self($this->replica, $errors))->onQueue('ssh')->delay(now()->addSeconds(30));
    }
}
