<?php

namespace App\Actions\Worker;

use App\Enums\WorkerStatus;
use App\Jobs\Worker\RestartJob;
use App\Jobs\Worker\StartJob;
use App\Jobs\Worker\StopJob;
use App\Models\Worker;

class ManageWorker
{
    public function start(Worker $worker): void
    {
        $worker->status = WorkerStatus::STARTING;
        $worker->save();
        dispatch(new StartJob($worker))->onQueue('ssh');
    }

    public function stop(Worker $worker): void
    {
        $worker->status = WorkerStatus::STOPPING;
        $worker->save();
        dispatch(new StopJob($worker))->onQueue('ssh');
    }

    public function restart(Worker $worker): void
    {
        $worker->status = WorkerStatus::RESTARTING;
        $worker->save();
        dispatch(new RestartJob($worker))->onQueue('ssh');
    }
}
