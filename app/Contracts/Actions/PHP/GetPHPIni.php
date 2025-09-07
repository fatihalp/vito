<?php

namespace App\Contracts\Actions\PHP;

use App\Models\Server;

interface GetPHPIni
{
    public function getIni(Server $server, array $input): string;
}
