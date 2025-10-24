<?php

namespace App\Jobs\Backup;

use App\Enums\BackupFileStatus;
use App\Enums\BackupStatus;
use App\Enums\BackupType;
use App\Models\Backup;
use App\Models\BackupFile;
use App\Models\Service;
use App\Services\Database\Database;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class RunBackupJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public function __construct(
        protected BackupFile $file,
        protected Backup $backup
    ) {}

    public function handle(): void
    {
        $this->run("server-{$this->backup->server_id}", function () {
            if ($this->backup->type === BackupType::DATABASE) {
                /** @var Service $service */
                $service = $this->backup->server->database();
                /** @var Database $databaseHandler */
                $databaseHandler = $service->handler();
                $databaseHandler->runBackup($this->file);
            }

            if ($this->backup->type === BackupType::FILE) {
                $this->compressAndUploadFile();
            }

            $this->file->status = BackupFileStatus::CREATED;
            $this->file->save();

            if ($this->backup->status !== BackupStatus::RUNNING) {
                $this->backup->status = BackupStatus::RUNNING;
                $this->backup->save();
            }
        });
    }

    public function failed(): void
    {
        $this->backup->status = BackupStatus::FAILED;
        $this->backup->save();
        $this->file->status = BackupFileStatus::FAILED;
        $this->file->save();
    }

    private function compressAndUploadFile(): void
    {
        $server = $this->backup->server;
        $sourcePath = $this->backup->path;
        $tempZipPath = $this->file->tempPath();

        // Remove any existing zip file first
        $server->os()->deleteFile($tempZipPath);

        // Compress the file/directory using OS service
        $server->os()->compress($sourcePath, $tempZipPath);

        // Upload to storage provider
        $upload = $this->backup->storage->provider()->ssh($server)->upload(
            $tempZipPath,
            $this->file->path()
        );

        // Clean up temporary file
        $server->os()->deleteFile($tempZipPath);

        // Set file size from upload response
        $this->file->size = $upload['size'];
        $this->file->save();
    }
}