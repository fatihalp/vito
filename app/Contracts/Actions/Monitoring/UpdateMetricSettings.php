<?php

namespace App\Contracts\Actions\Monitoring;

use App\Models\Server;

interface UpdateMetricSettings
{
    public function update(Server $server, array $input): void;
}
