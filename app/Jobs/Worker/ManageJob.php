<?php

namespace App\Jobs\Worker;

use App\Enums\WorkerStatus;
use App\Models\Worker;
use App\Traits\HandlesWorkerFailure;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class ManageJob implements ShouldQueue
{
    use HandlesWorkerFailure;
    use Queueable;
    use UniqueQueue;

    public function __construct(
        protected Worker $worker,
        protected string $action,
        protected WorkerStatus $successStatus,
        protected ?string $initiatedBy = null,
    ) {}

    public function handle(): void
    {
        $this->run("server-{$this->worker->server_id}", function () {
            $handler = $this->worker->server->processManager()->handler();
            $handler->{$this->action}($this->worker->id, $this->worker->site_id, $this->initiatedBy);
            $this->worker->status = $this->successStatus;
            $this->worker->error = null;
            $this->worker->save();
            $this->broadcastWorkerUpdate($this->worker);
            $this->broadcastSiteUpdate($this->worker->site);
        });
    }

    public function failed(Throwable $e): void
    {
        $this->markWorkerFailed($this->worker, $e, "{$this->action}-worker-failed");
        $this->broadcastSiteUpdate($this->worker->site);
    }
}
