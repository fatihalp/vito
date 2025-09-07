<?php

namespace App\Contracts\Actions\Database;

use App\Models\Backup;
use App\Models\BackupFile;

interface RunBackup
{
    public function run(Backup $backup): BackupFile;
}
