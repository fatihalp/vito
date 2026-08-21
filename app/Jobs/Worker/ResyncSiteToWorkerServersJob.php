<?php

namespace App\Jobs\Worker;

use App\Actions\Worker\SyncSiteToWorkerServer;
use App\Models\Server;
use App\Models\ServerLog;
use App\Models\Site;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

class ResyncSiteToWorkerServersJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public function __construct(protected Site $site)
    {
        $this->onQueue('ssh');
    }

    public function handle(): void
    {
        $this->run("site-{$this->site->id}-worker-resync", function () {
            $serverIds = $this->site->workers()
                ->whereNotNull('server_id')
                ->where('server_id', '!=', $this->site->server_id)
                ->distinct()
                ->pluck('server_id');

            foreach ($serverIds as $serverId) {
                $server = Server::find($serverId);
                if (! $server) {
                    continue;
                }

                try {
                    app(SyncSiteToWorkerServer::class)->sync($this->site, $server);
                } catch (Throwable $e) {
                    Log::warning("Failed to sync site #{$this->site->id} to worker server #{$server->id} after deploy: {$e->getMessage()}");
                    ServerLog::log($server, 'worker-server-resync-failed', $e->getMessage(), $this->site);
                }
            }
        });
    }
}
