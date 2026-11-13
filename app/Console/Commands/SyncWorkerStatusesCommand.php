<?php

namespace App\Console\Commands;

use App\Enums\ServerStatus;
use App\Jobs\Worker\SyncStatusesJob;
use App\Models\Server;
use Illuminate\Console\Command;

class SyncWorkerStatusesCommand extends Command
{
    protected $signature = 'workers:sync-statuses';

    protected $description = 'Sync worker statuses from each server process manager';

    public function handle(): void
    {
        Server::query()
            ->where('status', ServerStatus::READY)
            ->whereHas('workers')
            ->chunkById(50, function ($servers): void {
                foreach ($servers as $server) {
                    if ($server->processManager()) {
                        SyncStatusesJob::dispatch($server)->onQueue('ssh-checks');
                    }
                }
            });
    }
}
