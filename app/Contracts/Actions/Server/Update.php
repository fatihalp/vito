<?php

namespace App\Contracts\Actions\Server;

use App\Models\Server;

interface Update
{
    public function update(Server $server): void;
}
