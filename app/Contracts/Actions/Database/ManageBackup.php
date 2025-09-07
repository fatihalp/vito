<?php

namespace App\Contracts\Actions\Database;

use App\Models\Backup;
use App\Models\Server;

interface ManageBackup
{
    public function create(Server $server, array $input): Backup;

    public function update(Backup $backup, array $input): void;

    public function delete(Backup $backup): void;

    public function stop(Backup $backup): void;
}
