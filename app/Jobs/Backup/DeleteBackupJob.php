<?php

namespace App\Jobs\Backup;

use App\Enums\BackupFileStatus;
use App\Models\Backup;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class DeleteBackupJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public function __construct(protected Backup $backup) {}

    public function handle(): void
    {
        $this->run("server-{$this->backup->server_id}", function () {
            $files = $this->backup->files;
            foreach ($files as $file) {
                $file->status = BackupFileStatus::DELETING;
                $file->save();

                $file->deleteFile();
            }

            $this->backup->delete();
        });
    }
}