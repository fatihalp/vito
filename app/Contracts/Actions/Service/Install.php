<?php

namespace App\Contracts\Actions\Service;

use App\Models\Server;
use App\Models\Service;

interface Install
{
    public function install(Server $server, array $input): Service;
}
