<?php

namespace App\Jobs\Backup;

use App\Actions\Backup\BroadcastBackupUpdate;
use App\Actions\Backup\CheckBackupHealth;
use App\Actions\Backup\ManagePgBackRest;
use App\Actions\Backup\RunBackup;
use App\DTOs\SocketEventDTO;
use App\Enums\BackupFileStatus;
use App\Enums\BackupType;
use App\Events\SocketEvent;
use App\Http\Resources\BackupFileResource;
use App\Models\Backup;
use App\Models\BackupFile;
use App\Models\ServerLog;
use App\Models\Service;
use App\Services\Database\Database;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Str;
use Throwable;

class RunJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public int $timeout;

    public function __construct(
        protected BackupFile $file,
        protected Backup $backup,
    ) {
        $this->timeout = max(300, (int) config('core.backup_run_timeout'));
    }

    protected function lockSeconds(): int
    {
        return $this->timeout + 60;
    }

    public function handle(): void
    {
        $this->run("backup-{$this->backup->id}", function () {
            if ($this->backup->type === BackupType::PGBACKREST) {
                app(ManagePgBackRest::class)->run($this->file);

                return;
            }

            if ($this->backup->type === BackupType::DATABASE) {
                
                $service = $this->backup->server->database();
                
                $databaseHandler = $service->handler();
                $databaseHandler->runBackup($this->file);
            }

            if ($this->backup->type === BackupType::FILE) {
                app(RunBackup::class)->compressAndUploadFile($this->file, $this->backup);
            }

            $this->file->status = BackupFileStatus::CREATED;
            $this->file->message = null;
            $this->file->save();
            $this->broadcastFileUpdate();
            app(BroadcastBackupUpdate::class)->broadcast($this->backup);
            app(CheckBackupHealth::class)->check($this->backup);
        });
    }

    public function failed(Exception $e): void
    {
        $this->file->status = BackupFileStatus::FAILED;
        $this->file->message = Str::limit($e->getMessage(), 1000);
        $this->file->save();
        app(BroadcastBackupUpdate::class)->broadcast($this->backup);
        $this->broadcastFileUpdate();
        ServerLog::log($this->backup->server, 'run-backup-failed', $e->getMessage());
        $this->cleanupTempFile();
        app(CheckBackupHealth::class)->check($this->backup);
    }

    private function cleanupTempFile(): void
    {
        try {
            $this->backup->server->os()->deleteFile($this->file->tempPath());
        } catch (Throwable $e) {
            ServerLog::log($this->backup->server, 'cleanup-failed-backup', $e->getMessage());
        }
    }

    private function broadcastFileUpdate(): void
    {
        $this->file->refresh();

        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $this->file->backup->server->project_id,
            type: 'backup-file.updated',
            data: new BackupFileResource($this->file),
        ));
    }
}
