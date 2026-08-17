<?php

namespace App\Actions\Server;

use App\Enums\ServerStatus;
use App\Models\Server;
use Illuminate\Support\Facades\Log;
use Throwable;

class StopServer
{
    public function stop(Server $server): Server
    {
        try {
            $server->provider()->stop();
        } catch (Throwable $e) {
            Log::error("Failed to stop server #{$server->id} ({$server->name}) via provider: " . $e->getMessage());
        }

        $server->status = ServerStatus::DISCONNECTED;
        $server->save();

        app(BroadcastServerUpdate::class)->broadcast($server);

        return $server;
    }
}
