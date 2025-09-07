<?php

namespace App\Contracts\Actions\Database;

use App\Models\BackupFile;
use Symfony\Component\HttpFoundation\StreamedResponse;

interface ManageBackupFile
{
    public function download(BackupFile $file): StreamedResponse;

    public function delete(BackupFile $file): void;
}
