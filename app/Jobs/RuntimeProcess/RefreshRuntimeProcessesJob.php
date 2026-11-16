<?php

namespace App\Jobs\RuntimeProcess;

use App\Actions\RuntimeProcess\RefreshRuntimeProcesses;
use App\Models\Server;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class RefreshRuntimeProcessesJob implements ShouldBeUnique, ShouldQueue
{
    use Queueable;

    public int $tries = 1;
    public int $timeout = 120;
    public int $uniqueFor = 180;

    public function __construct(public Server $server)
    {
        $this->onQueue('ssh');
    }

    public function uniqueId(): string
    {
        return 'runtime-status-'.$this->server->id;
    }

    public function handle(RefreshRuntimeProcesses $action): void
    {
        $action->refresh($this->server);
    }
}
