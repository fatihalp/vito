<?php

declare(strict_types=1);

namespace App\Actions\CronJob;

use App\Enums\CronjobStatus;
use App\Models\CronJob;
use App\Models\Server;

class EnableCronJob
{
    public function enable(Server $server, CronJob $cronJob): void
    {
        app(SyncCronJobs::class)->sync($server, [$cronJob->user]);

        $cronJob->update(['status' => CronjobStatus::ENABLING]);
        app(SyncCronJobs::class)->write($server, $cronJob->user);
        $cronJob->update(['status' => CronjobStatus::READY]);
    }
}
