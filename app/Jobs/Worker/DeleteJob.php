<?php

namespace App\Jobs\Worker;

use App\Actions\Site\BroadcastSiteUpdate;
use App\DTOs\SocketEventDTO;
use App\Events\SocketEvent;
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

    public function __construct(protected Worker $worker) {}

    public function handle(): void
    {
        $this->run("server-{$this->worker->server_id}", function () {
            $this->worker->server->processManager()->handler()->delete($this->worker->id, $this->worker->site_id);
            $this->worker->delete();

            SocketEvent::dispatch(new SocketEventDTO(
                projectId: $this->worker->server->project_id,
                type: 'worker.deleted',
                data: ['id' => $this->worker->id],
            ));

            if ($this->worker->site) {
                app(BroadcastSiteUpdate::class)->broadcast($this->worker->site);
            }
        });
    }

    public function failed(Throwable $e): void
    {
        $this->markWorkerFailed($this->worker, $e, 'delete-worker-failed');

        if ($this->worker->site) {
            app(BroadcastSiteUpdate::class)->broadcast($this->worker->site);
        }
    }
}
