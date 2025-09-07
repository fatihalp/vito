<?php

namespace App\Contracts\Actions\Database;

use App\Models\Database;
use App\Models\Server;

interface CreateDatabase
{
    public function create(Server $server, array $input): Database;
}
