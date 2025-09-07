<?php

namespace App\Contracts\Actions\PHP;

use App\Models\Server;

interface ChangeDefaultCli
{
    public function change(Server $server, array $input): void;
}
