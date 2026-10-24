<?php

namespace App\Jobs\Server;

use App\Actions\Service\CheckServiceStatuses;
use App\Models\Server;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

class CollectServerMetricsJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public int $timeout = 120;

    public bool $deleteWhenMissingModels = true;

    public function __construct(protected Server $server) {}

    public function handle(): void
    {
        $this->run("server-{$this->server->id}-metrics", function (): void {
            try {
                $info = $this->server->os()->resourceInfo();
                $this->server->metrics()->create($info);
            } catch (Throwable $e) {
                Log::warning('Failed to collect metrics for server', ['server_id' => $this->server->id, 'error' => $e->getMessage()]);
            }

            try {
                app(CheckServiceStatuses::class)->check($this->server);
            } catch (Throwable $e) {
                Log::warning('Failed to check service statuses for server', ['server_id' => $this->server->id, 'error' => $e->getMessage()]);
            }
        });
    }

    protected function whenLocked(): void
    {
    }

    public function failed(Throwable $e): void
    {
        Log::warning('Metrics job failed for server', ['server_id' => $this->server->id, 'error' => $e->getMessage()]);
    }
}
