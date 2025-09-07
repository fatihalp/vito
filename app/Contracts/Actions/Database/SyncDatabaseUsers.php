<?php

namespace App\Contracts\Actions\Database;

use App\Models\Server;

interface SyncDatabaseUsers
{
    public function sync(Server $server): void;
}
