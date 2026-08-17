<?php

namespace App\Actions\Server;

use App\Enums\ServerStatus;
use App\Models\Server;
use Illuminate\Support\Facades\Log;
use Throwable;

class StartServer
{
    public function start(Server $server): Server
    {
        try {
            $server->provider()->start();
        } catch (Throwable $e) {
            Log::error("Failed to start server #{$server->id} ({$server->name}) via provider: " . $e->getMessage());
        }

        $server->status = ServerStatus::READY;
        $server->save();

        app(BroadcastServerUpdate::class)->broadcast($server);

        return $server;
    }
}
