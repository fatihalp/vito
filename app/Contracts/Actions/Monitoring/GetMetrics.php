<?php

namespace App\Contracts\Actions\Monitoring;

use App\Models\Server;
use Illuminate\Support\Collection;

interface GetMetrics
{
    public function filter(Server $server, array $input): Collection;
}
