<?php

namespace App\Contracts\Actions\PHP;

use App\Models\Server;
use App\Models\Service;

interface InstallPHPExtension
{
    public function install(Server $server, array $input): Service;
}
