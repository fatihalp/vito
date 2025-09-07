<?php

namespace App\Contracts\Actions\CronJob;

use App\Models\CronJob;
use App\Models\Server;

interface EditCronJob
{
    public function edit(Server $server, CronJob $cronJob, array $input): CronJob;
}
