<?php

namespace App\Jobs\Worker;

use App\Actions\Worker\SyncWorkerStatuses;
use App\Models\Server;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SyncStatusesJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public int $timeout = 90;

    public function __construct(protected Server $server) {}

    public function handle(): void
    {
        $this->run("server-{$this->server->id}", function () {
            app(SyncWorkerStatuses::class)->sync($this->server);
        });
    }

    protected function whenLocked(): void {}
}
