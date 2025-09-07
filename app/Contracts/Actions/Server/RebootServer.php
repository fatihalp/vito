<?php

namespace App\Contracts\Actions\Server;

use App\Models\Server;

interface RebootServer
{
    public function reboot(Server $server): Server;
}
