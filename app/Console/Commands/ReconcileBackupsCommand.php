<?php

namespace App\Console\Commands;

use App\Actions\Backup\BroadcastBackupUpdate;
use App\Actions\Backup\CheckBackupHealth;
use App\DTOs\SocketEventDTO;
use App\Enums\BackupFileStatus;
use App\Enums\BackupRestoreStatus;
use App\Enums\BackupStatus;
use App\Events\SocketEvent;
use App\Facades\Notifier;
use App\Http\Resources\BackupFileResource;
use App\Models\Backup;
use App\Models\BackupFile;
use App\Models\BackupRestore;
use App\Jobs\Backup\RestoreToNewServerJob;
use App\Notifications\FailedToDeleteBackupFileFromProvider;
use App\Notifications\RestoreFailed;
use Illuminate\Console\Command;

class ReconcileBackupsCommand extends Command
{
    protected $signature = 'backups:reconcile';

    protected $description = 'Fail backup files stuck in a transient state after an interrupted job';

    
    public function handle(): void
    {
        $threshold = now()->subSeconds(2 * (int) config('core.backup_run_timeout'));
        $files = 0;
        $backups = 0;

        BackupFile::query()
            ->whereIn('status', [
                BackupFileStatus::CREATING,
                BackupFileStatus::RESTORING,
                BackupFileStatus::DELETING,
            ])
            ->where('updated_at', '<', $threshold)
            ->whereHas('backup.server')
            ->with('backup.server', 'backup.storage')
            ->chunkById(100, function ($chunk) use (&$files): void {
                
                foreach ($chunk as $file) {
                    $this->reconcile($file);
                    $files++;
                }
            });

        Backup::query()
            ->whereIn('status', [BackupStatus::DELETING, BackupStatus::INSTALLING])
            ->where('updated_at', '<', $threshold)
            ->whereHas('server')
            ->with('server')
            ->chunkById(100, function ($chunk) use (&$backups): void {

                foreach ($chunk as $backup) {
                    $backup->status = $backup->status === BackupStatus::INSTALLING ? BackupStatus::FAILED : null;
                    $backup->save();
                    $backups++;

                    app(BroadcastBackupUpdate::class)->broadcast($backup);
                }
            });

        BackupRestore::query()
            ->whereIn('status', [BackupRestoreStatus::WAITING_FOR_SERVER, BackupRestoreStatus::RESTORING])
            ->where('updated_at', '<', now()->subMinutes(30))
            ->each(fn (BackupRestore $restore) => dispatch(new RestoreToNewServerJob($restore))->onQueue('ssh'));

        $this->info("{$files} stuck backup files and {$backups} backups reconciled");
    }

    private function reconcile(BackupFile $file): void
    {
        $server = $file->backup->server;
        $previous = $file->status;

        $file->status = match ($previous) {
            BackupFileStatus::RESTORING => BackupFileStatus::RESTORE_FAILED,
            BackupFileStatus::DELETING => BackupFileStatus::DELETE_FAILED,
            default => BackupFileStatus::FAILED,
        };
        $file->message = __('Interrupted — no active job. Marked failed by reconciliation.');
        $file->save();

        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $server->project_id,
            type: 'backup-file.updated',
            data: new BackupFileResource($file),
        ));

        match ($previous) {
            BackupFileStatus::RESTORING => Notifier::send($server, new RestoreFailed($server, $file)),
            BackupFileStatus::DELETING => Notifier::send($server, new FailedToDeleteBackupFileFromProvider($file)),
            default => app(CheckBackupHealth::class)->check($file->backup),
        };
    }
}
