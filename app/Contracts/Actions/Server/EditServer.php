<?php

namespace App\Contracts\Actions\Server;

use App\Models\Server;

interface EditServer
{
    public function edit(Server $server, array $input): Server;
}
