<?php

declare(strict_types=1);

namespace App\Actions\CronJob;

use App\Enums\CronjobStatus;
use App\Models\CronJob;
use App\Models\Server;

class DeleteCronJob
{
    public function delete(Server $server, CronJob $cronJob): void
    {
        app(SyncCronJobs::class)->sync($server, [$cronJob->user]);

        $cronJob->update(['status' => CronjobStatus::DELETING]);
        app(SyncCronJobs::class)->write($server, $cronJob->user);
        $cronJob->delete();
    }
}
