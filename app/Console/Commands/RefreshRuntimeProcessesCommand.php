<?php

namespace App\Console\Commands;

use App\Enums\ServerStatus;
use App\Jobs\RuntimeProcess\RefreshRuntimeProcessesJob;
use App\Models\RuntimeProcess;
use App\Models\Server;
use Illuminate\Console\Command;

class RefreshRuntimeProcessesCommand extends Command
{
    protected $signature = 'runtime:refresh';
    protected $description = 'Refresh registered systemd, Docker and Supervisor processes';

    public function handle(): int
    {
        Server::query()->where('status', ServerStatus::READY)
            ->whereIn('id', RuntimeProcess::query()->select('server_id'))
            ->eachById(fn (Server $server) => RefreshRuntimeProcessesJob::dispatch($server));

        return self::SUCCESS;
    }
}
