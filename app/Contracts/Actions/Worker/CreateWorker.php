<?php

namespace App\Contracts\Actions\Worker;

use App\Models\Server;
use App\Models\Site;
use App\Models\Worker;

interface CreateWorker
{
    public function create(Server $server, array $input, ?Site $site = null): Worker;
}
