<?php

namespace App\Actions\Monitoring;

use App\Models\Server;
use InvalidArgumentException;
use Throwable;

class KillProcess
{
    public function handle(Server $server, int $pid): bool
    {
        if ($pid <= 1) {
            throw new InvalidArgumentException('Cannot kill system process with PID ' . $pid);
        }

        try {
            $server->ssh()->exec('sudo kill -9 ' . (int) $pid);
            return true;
        } catch (Throwable $e) {
            return false;
        }
    }
}
