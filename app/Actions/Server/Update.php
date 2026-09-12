<?php

namespace App\Actions\Server;

use App\Enums\ServerStatus;
use App\Jobs\Server\UpdateJob;
use App\Models\Server;
use App\Models\ServerLog;

class Update
{
    public function update(Server $server, bool $notify = false): ServerLog
    {
        $server->status = ServerStatus::UPDATING;
        $server->save();
        app(BroadcastServerUpdate::class)->broadcast($server);

        $log = ServerLog::newLog($server, 'upgrade');
        $log->save();

        dispatch(new UpdateJob($server, $notify, $log))->onQueue('ssh');

        return $log;
    }
}
