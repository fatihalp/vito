<?php

namespace App\Jobs\Backup;

use App\Models\BackupFile;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class DeleteBackupFileJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public function __construct(protected BackupFile $file) {}

    public function handle(): void
    {
        $this->run("server-{$this->file->backup->server_id}", function () {
            $this->file->deleteFile();
        });
    }
}