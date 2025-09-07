<?php

namespace App\Contracts\Actions\Database;

use App\Models\DatabaseUser;
use App\Models\Server;

interface CreateDatabaseUser
{
    public function create(Server $server, array $input, array $links = []): DatabaseUser;
}
