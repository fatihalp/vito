<?php

namespace App\Jobs\Worker;

use App\DTOs\SocketEventDTO;
use App\Enums\WorkerStatus;
use App\Events\SocketEvent;
use App\Models\ServerLog;
use App\Models\Worker;
use App\Traits\HandlesWorkerFailure;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class DeleteJob implements ShouldQueue
{
    use HandlesWorkerFailure;
    use Queueable;
    use UniqueQueue;

    public function __construct(
        protected Worker $worker,
        protected ?WorkerStatus $previousStatus = null,
    ) {}

    public function handle(): void
    {
        $this->run("server-{$this->worker->server_id}", function () {
            $processManager = $this->worker->server->processManager();

            if ($processManager) {
                $processManager->handler()->delete($this->worker->id, $this->worker->site_id);
            }

            $this->finalizeDeletion();
        });
    }

    public function failed(Throwable $e): void
    {
        if ($this->previousStatus === WorkerStatus::FAILED) {
            ServerLog::log($this->worker->server, 'delete-worker-failed', $e->getMessage());
            $this->finalizeDeletion();

            return;
        }

        $this->markWorkerFailed($this->worker, $e, 'delete-worker-failed');
        $this->broadcastSiteUpdate($this->worker->site);
    }

    private function finalizeDeletion(): void
    {
        $workerId = $this->worker->id;
        $projectId = $this->worker->server->project_id;
        $site = $this->worker->site;

        $this->worker->delete();

        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $projectId,
            type: 'worker.deleted',
            data: ['id' => $workerId],
        ));

        $this->broadcastSiteUpdate($site);
    }
}
