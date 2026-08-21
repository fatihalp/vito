<?php

namespace App\Actions\Database;

use App\Actions\SiteResource\GuardProvisionedDatabase;
use App\Models\DatabaseUser;
use App\Models\Server;
use App\Models\Service;
use App\Services\Database\Database;

class DeleteDatabaseUser
{
    public function __construct(private GuardProvisionedDatabase $guard) {}

    public function delete(Server $server, DatabaseUser $databaseUser, bool $allowManaged = false): void
    {
        if (! $allowManaged) {
            $this->guard->user($databaseUser);
        }

        
        $service = $server->database();
        
        $handler = $service->handler();
        $handler->deleteUser($databaseUser->username, $databaseUser->host);
        $databaseUser->delete();
    }
}
