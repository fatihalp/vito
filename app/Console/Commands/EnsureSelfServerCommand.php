<?php

namespace App\Console\Commands;

use App\Actions\Server\EnsureSelfServerExists;
use Illuminate\Console\Command;

class EnsureSelfServerCommand extends Command
{
    protected $signature = 'vito:ensure-self-server';

    protected $description = 'Ensure the host server where Vito is installed exists in the server list';

    public function handle(EnsureSelfServerExists $action): int
    {
        $server = $action->ensure();

        if (! $server) {
            $this->warn('No project or user found. Create a user first before provisioning the self server.');

            return self::FAILURE;
        }

        $this->info("Self server ensured: [ID: {$server->id}] {$server->name} ({$server->ip})");

        return self::SUCCESS;
    }
}
