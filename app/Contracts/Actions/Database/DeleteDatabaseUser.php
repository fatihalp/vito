<?php

namespace App\Contracts\Actions\Database;

use App\Models\DatabaseUser;
use App\Models\Server;

interface DeleteDatabaseUser
{
    public function delete(Server $server, DatabaseUser $databaseUser): void;
}
