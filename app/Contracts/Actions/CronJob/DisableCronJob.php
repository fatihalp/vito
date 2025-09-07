<?php

namespace App\Contracts\Actions\CronJob;

use App\Models\CronJob;
use App\Models\Server;

interface DisableCronJob
{
    public function disable(Server $server, CronJob $cronJob): void;
}
