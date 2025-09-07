<?php

namespace App\Contracts\Actions\Server;

use App\Models\Server;
use App\Models\User;

interface TransferServer
{
    public function transfer(User $user, Server $server, array $input): Server;
}
