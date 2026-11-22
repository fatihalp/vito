<?php

namespace App\Actions\Worker;

use App\Enums\WorkerLogType;
use App\Enums\WorkerStatus;
use App\Jobs\Worker\ManageJob;
use App\Models\User;
use App\Models\Worker;

class ManageWorker
{
    public function start(Worker $worker, ?User $user = null): void
    {
        $this->transition($worker, 'start', WorkerStatus::STARTING, WorkerStatus::RUNNING, WorkerLogType::STARTED, 'started', $user);
    }

    public function stop(Worker $worker, ?User $user = null): void
    {
        $this->transition($worker, 'stop', WorkerStatus::STOPPING, WorkerStatus::STOPPED, WorkerLogType::STOPPED, 'stopped', $user);
    }

    public function restart(Worker $worker, ?User $user = null): void
    {
        $this->transition($worker, 'restart', WorkerStatus::RESTARTING, WorkerStatus::RUNNING, WorkerLogType::RESTARTED, 'restarted', $user);
    }

    private function transition(
        Worker $worker,
        string $action,
        WorkerStatus $pendingStatus,
        WorkerStatus $successStatus,
        WorkerLogType $logType,
        string $pastTense,
        ?User $user,
    ): void {
        $actor = $user ?? user();
        $worker->status = $pendingStatus;
        $worker->error = null;
        $worker->save();

        $worker->recordLog(
            $logType,
            $actor ? "Worker {$pastTense} manually by {$actor->name}" : "Worker {$pastTense} manually",
            $actor?->id
        );

        dispatch(new ManageJob($worker, $action, $successStatus, $actor?->name))->onQueue('ssh');
    }
}
