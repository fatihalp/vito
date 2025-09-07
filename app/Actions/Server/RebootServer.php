<?php

namespace App\Actions\Server;

use App\Contracts\Actions\Server\RebootServer as RebootServerContract;
use App\Enums\ServerStatus;
use App\Models\Server;
use Throwable;

class RebootServer implements RebootServerContract
{
    public function reboot(Server $server): Server
    {
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
