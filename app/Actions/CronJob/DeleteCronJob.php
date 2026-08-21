<?php

namespace App\Actions\CronJob;

use App\Enums\CronjobStatus;
use App\Exceptions\SSHError;
use App\Models\CronJob;
use App\Models\Server;

class DeleteCronJob
{
    
    public function delete(Server $server, CronJob $cronJob): void
    {
        
        app(SyncCronJobs::class)->sync($server);

        $user = $cronJob->user;
        $cronJob->status = CronjobStatus::DELETING;
        $cronJob->save();
        $server->cron()->update($cronJob->user, CronJob::crontab($server, $user));
        $cronJob->delete();
    }
}
