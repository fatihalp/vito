<?php

namespace App\Actions\Server;

use App\Enums\ServerStatus;
use App\Exceptions\AppError;
use App\Models\Server;

class StopServer
{
    /**
     * @throws AppError
     */
    public function stop(Server $server): Server
    {
        if (! $server->canPowerManage()) {
            throw new AppError(__('The :provider provider does not support power management for this server.', ['provider' => $server->provider]));
        }

        $server->provider()->stop();

        $server->status = ServerStatus::DISCONNECTED;
        $server->save();

        app(BroadcastServerUpdate::class)->broadcast($server);

        return $server;
    }
}
