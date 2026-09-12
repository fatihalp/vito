<?php

namespace App\Actions\Server;

use App\Enums\ServerStatus;
use App\Jobs\Server\UpdateKernelJob;
use App\Models\Server;
use App\Models\ServerLog;

class UpdateKernel
{
    public function updateKernel(Server $server): ServerLog
    {
        $server->status = ServerStatus::UPDATING;
        $server->save();
        app(BroadcastServerUpdate::class)->broadcast($server);

        $log = ServerLog::newLog($server, 'upgrade-kernel');
        $log->save();

        dispatch(new UpdateKernelJob($server, $log))->onQueue('ssh');

        return $log;
    }
}
