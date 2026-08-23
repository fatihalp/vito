<?php

namespace App\Actions\Monitoring;

use App\Models\Server;
use InvalidArgumentException;
use Throwable;

class KillUserProcesses
{
    public function handle(Server $server, string $user): bool
    {
        $user = trim($user);
        if ($user === '' || ! preg_match('/^[a-zA-Z0-9_\-\.]+$/', $user)) {
            throw new InvalidArgumentException('Invalid username provided.');
        }

        try {
            $escapedUser = escapeshellarg($user);
            $server->ssh()->exec("sudo pkill -9 -u {$escapedUser} 2>/dev/null || sudo killall -9 -u {$escapedUser} 2>/dev/null || true");
            return true;
        } catch (Throwable $e) {
            return false;
        }
    }
}
