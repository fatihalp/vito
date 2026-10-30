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
        $user = $user ?? user();
        $worker->status = WorkerStatus::STARTING;
        $worker->error = null;
        $worker->save();

        $worker->recordLog(
            WorkerLogType::STARTED,
            $user ? "Worker started manually by {$user->name}" : 'Worker started manually',
            $user?->id
        );

        dispatch(new ManageJob($worker, 'start', WorkerStatus::RUNNING, $user?->name))->onQueue('ssh');
    }

    public function stop(Worker $worker, ?User $user = null): void
    {
        $user = $user ?? user();
        $worker->status = WorkerStatus::STOPPING;
        $worker->error = null;
        $worker->save();

        $worker->recordLog(
            WorkerLogType::STOPPED,
            $user ? "Worker stopped manually by {$user->name}" : 'Worker stopped manually',
            $user?->id
        );

        dispatch(new ManageJob($worker, 'stop', WorkerStatus::STOPPED, $user?->name))->onQueue('ssh');
    }

    public function restart(Worker $worker, ?User $user = null): void
    {
        $user = $user ?? user();
        $worker->status = WorkerStatus::RESTARTING;
        $worker->error = null;
        $worker->save();

        $worker->recordLog(
            WorkerLogType::RESTARTED,
            $user ? "Worker restarted manually by {$user->name}" : 'Worker restarted manually',
            $user?->id
        );

        dispatch(new ManageJob($worker, 'restart', WorkerStatus::RUNNING, $user?->name))->onQueue('ssh');
    }
}
