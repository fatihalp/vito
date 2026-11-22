<?php

namespace App\Jobs\Worker;

use App\Enums\WorkerStatus;
use App\Models\Worker;
use App\Traits\HandlesWorkerFailure;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class EditJob implements ShouldQueue
{
    use HandlesWorkerFailure;
    use Queueable;
    use UniqueQueue;

    public function __construct(protected Worker $worker) {}

    public function handle(): void
    {
        $this->run("server-{$this->worker->server_id}", function () {
            $processManager = $this->worker->server->processManager()->handler();
            $processManager->delete($this->worker->id, $this->worker->site_id);
            $processManager->create($this->worker);
            $this->worker->status = WorkerStatus::RUNNING;
            $this->worker->error = null;
            $this->worker->save();
            $this->broadcastWorkerUpdate($this->worker);
            $this->broadcastSiteUpdate($this->worker->site);
        });
    }

    public function failed(Throwable $e): void
    {
        $this->markWorkerFailed($this->worker, $e, 'edit-worker-failed');
        $this->broadcastSiteUpdate($this->worker->site);
    }
}
