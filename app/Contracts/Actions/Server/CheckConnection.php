<?php

namespace App\Contracts\Actions\Server;

use App\Models\Server;

interface CheckConnection
{
    public function check(Server $server, int $retry = 2): Server;
}
