<?php

namespace App\Contracts\Actions\CronJob;

use App\Models\CronJob;
use App\Models\Server;

interface EnableCronJob
{
    public function enable(Server $server, CronJob $cronJob): void;
}
