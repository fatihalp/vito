<?php

namespace App\Actions\CronJob;

use App\Contracts\Actions\CronJob\DisableCronJob as DisableCronJobContract;
use App\Enums\CronjobStatus;
use App\Exceptions\SSHError;
use App\Models\CronJob;
use App\Models\Server;

class DisableCronJob implements DisableCronJobContract
{
    /**
     * @throws SSHError
     */
    public function disable(Server $server, CronJob $cronJob): void
    {
        $cronJob->status = CronjobStatus::DISABLING;
        $cronJob->save();

        $server->cron()->update($cronJob->user, CronJob::crontab($server, $cronJob->user));
        $cronJob->status = CronjobStatus::DISABLED;
        $cronJob->save();
    }
}
