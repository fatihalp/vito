<?php

namespace App\Jobs\Site;

use App\Actions\SiteStats\SyncGoAccessServer;
use App\Models\Server;
use App\Models\ServerLog;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class ResyncGoAccessJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public int $timeout = 300;

    public function __construct(protected Server $server)
    {
        $this->onQueue('ssh');
    }

    public function handle(): void
    {
        $this->run("server-{$this->server->id}-site-stats", function (): void {
            app(SyncGoAccessServer::class)->sync($this->server);
        });
    }

    public function failed(Throwable $e): void
    {
        ServerLog::log($this->server, 'resync-goaccess-failed', $e->getMessage());
    }
}
