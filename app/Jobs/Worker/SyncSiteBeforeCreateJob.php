<?php

namespace App\Jobs\Worker;

use App\Actions\Worker\SyncSiteToWorkerServer;
use App\Models\Worker;
use App\Traits\HandlesWorkerFailure;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class SyncSiteBeforeCreateJob implements ShouldQueue
{
    use HandlesWorkerFailure;
    use Queueable;
    use UniqueQueue;

    public function __construct(protected Worker $worker) {}

    public function handle(): void
    {
        $this->run("server-{$this->worker->server_id}", function () {
            if (! $this->worker->site) {
                return;
            }

            app(SyncSiteToWorkerServer::class)->sync($this->worker->site, $this->worker->server);
        });
    }

    public function failed(Throwable $e): void
    {
        $this->markWorkerFailed($this->worker, $e, 'sync-site-to-worker-server-failed');
    }
}
