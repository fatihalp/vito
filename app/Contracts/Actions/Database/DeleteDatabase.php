<?php

namespace App\Contracts\Actions\Database;

use App\Models\Database;
use App\Models\Server;

interface DeleteDatabase
{
    public function delete(Server $server, Database $database): void;
}
