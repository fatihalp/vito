<?php

namespace App\Contracts\Actions\PHP;

use App\Models\Server;

interface UpdatePHPIni
{
    public function update(Server $server, array $input): void;
}
