<?php

namespace App\Actions\CronJob;

use App\Contracts\Actions\CronJob\DeleteCronJob as DeleteCronJobContract;
use App\Enums\CronjobStatus;
use App\Exceptions\SSHError;
use App\Models\CronJob;
use App\Models\Server;

class DeleteCronJob implements DeleteCronJobContract
{
    /**
     * @throws SSHError
     */
    public function delete(Server $server, CronJob $cronJob): void
    {
        $user = $cronJob->user;
        $cronJob->status = CronjobStatus::DELETING;
        $cronJob->save();
        $server->cron()->update($cronJob->user, CronJob::crontab($server, $user));
        $cronJob->delete();
    }
}
