<?php

namespace App\Actions\Monitoring;

use App\Models\Server;
use Illuminate\Validation\ValidationException;

class KillUserProcesses
{
    private const PROTECTED_USERS = [
        'root', 'daemon', 'sys', 'sync', 'games', 'man', 'lp', 'mail',
        'news', 'uucp', 'proxy', 'www-data', 'backup', 'list', 'irc',
        'nobody', 'systemd-network', 'systemd-resolve', 'messagebus',
        'sshd', 'vito',
    ];

    public function handle(Server $server, string $user): bool
    {
        $user = trim($user);

        if ($user === '' || ! preg_match('/^[a-zA-Z0-9_\-\.]+$/', $user)) {
            throw ValidationException::withMessages(['user' => 'Invalid username provided.']);
        }

        if (in_array($user, self::PROTECTED_USERS, true)) {
            throw ValidationException::withMessages(['user' => 'Cannot kill processes for system user: ' . $user]);
        }

        $escapedUser = escapeshellarg($user);
        $server->ssh()->exec("sudo pkill -9 -u {$escapedUser} 2>/dev/null || sudo killall -9 -u {$escapedUser} 2>/dev/null || true");

        return true;
    }
}
