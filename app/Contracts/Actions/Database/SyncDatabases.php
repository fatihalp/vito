<?php

namespace App\Contracts\Actions\Database;

use App\Models\Server;

interface SyncDatabases
{
    public function sync(Server $server): void;
}
