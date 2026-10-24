<?php

namespace App\Console\Commands;

use App\Enums\ServerStatus;
use App\Jobs\Server\CollectServerMetricsJob;
use App\Models\Server;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Builder;

class GetMetricsCommand extends Command
{
    protected $signature = 'metrics:get';

    protected $description = 'Queue metric collection for every monitored server';

    public function handle(): void
    {
        $queued = 0;

        Server::query()
            ->where('status', ServerStatus::READY)
            ->whereHas('services', function (Builder $query): void {
                $query->where('type', 'monitoring')
                    ->where('name', 'remote-monitor');
            })
            ->chunkById(50, function ($servers) use (&$queued): void {
                foreach ($servers as $server) {
                    dispatch(new CollectServerMetricsJob($server))->onQueue('ssh-checks');
                    $queued++;
                }
            });

        $this->info("Queued metrics for {$queued} servers");
    }
}
