<?php

namespace App\Jobs\Backup;

use App\Enums\BackupFileStatus;
use App\Models\BackupFile;
use App\Models\Database;
use App\Models\Service;
use App\Services\Database\Database as DatabaseService;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class RestoreDatabaseJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public function __construct(
        protected BackupFile $backupFile,
        protected Database $database
    ) {}

    public function handle(): void
    {
        $this->run("server-{$this->database->server_id}", function () {
            /** @var Service $service */
            $service = $this->database->server->database();
            /** @var DatabaseService $databaseHandler */
            $databaseHandler = $service->handler();
            $databaseHandler->restoreBackup($this->backupFile, $this->database->name);
            $this->backupFile->status = BackupFileStatus::RESTORED;
            $this->backupFile->restored_at = now();
            $this->backupFile->save();
        });
    }

    public function failed(): void
    {
        $this->backupFile->status = BackupFileStatus::RESTORE_FAILED;
        $this->backupFile->save();
    }
}