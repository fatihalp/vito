<?php

namespace App\Contracts\Actions\Database;

use App\Models\BackupFile;

interface RestoreBackup
{
    public function restore(BackupFile $backupFile, array $input): void;
}
