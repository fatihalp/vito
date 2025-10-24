<?php

namespace App\Jobs\Worker;

use App\Enums\WorkerStatus;
use App\Models\Service;
use App\Models\Worker;
use App\Services\ProcessManager\ProcessManager;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class StopJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public function __construct(protected Worker $worker) {}

    public function handle(): void
    {
        $this->run("server-{$this->worker->server_id}", function () {
            /** @var Service $service */
            $service = $this->worker->server->processManager();
            /** @var ProcessManager $handler */
            $handler = $service->handler();
            $handler->stop($this->worker->id, $this->worker->site_id);
            $this->worker->status = WorkerStatus::STOPPED;
            $this->worker->save();
        });
    }
}