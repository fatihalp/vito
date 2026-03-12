<?php

namespace App\Actions\Server;

use App\Enums\ServerStatus;
use App\Models\Server;
use Illuminate\Validation\ValidationException;
use Throwable;

class RebootServer
{
    public function reboot(Server $server): Server
    {
        if ($server->isLocal()) {
            throw ValidationException::withMessages([
                'server' => 'Cannot reboot the local server as it would stop Vito itself.',
            ]);
        }

        try {
            $server->os()->reboot();
            $server->status = ServerStatus::DISCONNECTED;
            $server->save();
        } catch (Throwable) {
            $server = $server->checkConnection();
        }

        return $server;
    }
}
