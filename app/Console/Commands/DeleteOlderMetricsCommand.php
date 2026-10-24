<?php

namespace App\Console\Commands;

use App\Models\Service;
use Illuminate\Console\Command;

class DeleteOlderMetricsCommand extends Command
{
    protected $signature = 'metrics:delete-older-metrics';

    protected $description = 'Delete older metrics from database';

    public function handle(): void
    {
        Service::query()
            ->where('type', 'monitoring')
            ->whereHas('server')
            ->with('server')
            ->chunkById(100, function ($services): void {
                foreach ($services as $service) {
                    $cutoff = now()->subDays((int) ($service->handler()->data()['data_retention'] ?? 10));
                    $deleted = 0;

                    do {
                        $batch = $service->server->metrics()->where('created_at', '<', $cutoff)->limit(5000)->delete();
                        $deleted += $batch;
                    } while ($batch > 0);

                    $this->info("Deleted {$deleted} older metrics for server {$service->server->name}");
                }
            });
    }
}
