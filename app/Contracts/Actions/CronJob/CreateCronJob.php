<?php

namespace App\Contracts\Actions\CronJob;

use App\Models\CronJob;
use App\Models\Server;

interface CreateCronJob
{
    public function create(Server $server, array $input): CronJob;
}
