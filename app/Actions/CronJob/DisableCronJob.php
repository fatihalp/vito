<?php

declare(strict_types=1);

namespace App\Actions\CronJob;

use App\Enums\CronjobStatus;
use App\Models\CronJob;
use App\Models\Server;

class DisableCronJob
{
    public function disable(Server $server, CronJob $cronJob): void
    {
        app(SyncCronJobs::class)->sync($server, [$cronJob->user]);

        $cronJob->update(['status' => CronjobStatus::DISABLING]);
        app(SyncCronJobs::class)->write($server, $cronJob->user);
        $cronJob->update(['status' => CronjobStatus::DISABLED]);
    }
}
