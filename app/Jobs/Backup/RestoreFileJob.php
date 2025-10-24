<?php

namespace App\Jobs\Backup;

use App\Enums\BackupFileStatus;
use App\Models\BackupFile;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class RestoreFileJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public function __construct(
        protected BackupFile $backupFile,
        protected string $restorePath,
        protected string $owner,
        protected string $permissions
    ) {}

    public function handle(): void
    {
        $this->run("server-{$this->backupFile->backup->server_id}", function () {
            $server = $this->backupFile->backup->server;
            $tempBackupPath = $this->backupFile->tempPath();

            // Download backup from storage provider
            $this->backupFile->backup->storage->provider()->ssh($server)->download(
                $this->backupFile->path(),
                $tempBackupPath
            );

            // Extract the archive using OS service with custom owner and permissions
            $server->os()->extractArchive($tempBackupPath, $this->restorePath, $this->owner, $this->permissions);

            // Clean up temporary file
            $server->os()->deleteFile($tempBackupPath);

            $this->backupFile->status = BackupFileStatus::RESTORED;
            $this->backupFile->restored_at = now();
            $this->backupFile->save();
        });
    }

    public function failed(): void
    {
        $this->backupFile->status = BackupFileStatus::RESTORE_FAILED;
        $this->backupFile->save();
        $this->backupFile->backup->server->os()->deleteFile($this->backupFile->tempPath());
    }
}