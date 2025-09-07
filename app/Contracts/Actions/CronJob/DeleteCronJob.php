<?php

namespace App\Contracts\Actions\CronJob;

use App\Models\CronJob;
use App\Models\Server;

interface DeleteCronJob
{
    public function delete(Server $server, CronJob $cronJob): void;
}
