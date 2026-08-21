<?php

namespace App\Actions\Database;

use App\Actions\Backup\ManageBackup;
use App\Actions\SiteResource\GuardProvisionedDatabase;
use App\Models\Backup;
use App\Models\Database;
use App\Models\Server;
use App\Models\Service;

class DeleteDatabase
{
    public function __construct(private GuardProvisionedDatabase $guard) {}

    public function delete(Server $server, Database $database, bool $allowManaged = false): void
    {
        if (! $allowManaged) {
            $this->guard->database($database);
        }

        
        $service = $server->database();
        
        $handler = $service->handler();
        $handler->delete($database->name);
        $database->delete();

        $database->backups()->each(function (Backup $backup): void {
            app(ManageBackup::class)->stop($backup);
        });
    }
}
