<?php

namespace App\Actions\Monitoring;

use App\Models\Server;
use Illuminate\Validation\ValidationException;

class KillProcess
{
    public function handle(Server $server, int $pid): bool
    {
        if ($pid <= 1) {
            throw ValidationException::withMessages(['pid' => 'Cannot kill system process with PID ' . $pid]);
        }

        $server->ssh()->exec('sudo kill -9 ' . $pid);

        return true;
    }
}
