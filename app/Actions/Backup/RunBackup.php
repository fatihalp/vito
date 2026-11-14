<?php

namespace App\Actions\Backup;

use App\DTOs\SocketEventDTO;
use App\Enums\BackupFileStatus;
use App\Enums\BackupType;
use App\Enums\PostgresClusterStatus;
use App\Events\SocketEvent;
use App\Http\Resources\BackupFileResource;
use App\Jobs\Backup\RunJob;
use App\Models\Backup;
use App\Models\BackupFile;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class RunBackup
{
    public function run(Backup $backup, ?string $pgBackRestType = null): BackupFile
    {
        if ($backup->type === BackupType::PGBACKREST && $backup->cluster?->status !== PostgresClusterStatus::ACTIVE) {
            throw ValidationException::withMessages([
                'backup' => __('The PostgreSQL cluster is failing over. Backups start again when it finishes.'),
            ]);
        }

        if ($backup->type === BackupType::PGBACKREST && $backup->files()->where('status', BackupFileStatus::CREATING)->exists()) {
            throw ValidationException::withMessages([
                'backup' => __('A pgBackRest backup is already running on this server.'),
            ]);
        }

        $backupName = match ($backup->type) {
            BackupType::DATABASE => $backup->database?->name,
            BackupType::PGBACKREST => $backup->cluster->stanza,
        };

        $file = new BackupFile([
            'backup_id' => $backup->id,
            'name' => Str::of($backupName)->slug().'-'.now()->format('YmdHis'),
            'status' => BackupFileStatus::CREATING,
            'type' => $backup->type === BackupType::PGBACKREST ? ($pgBackRestType ?? 'incr') : null,
        ]);
        $file->save();
        $file->setRelation('backup', $backup);

        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $backup->server->project_id,
            type: 'backup-file.created',
            data: new BackupFileResource($file),
        ));

        app(BroadcastBackupUpdate::class)->broadcast($backup);

        dispatch(new RunJob($file, $backup))->onQueue('ssh');

        return $file;
    }
}
