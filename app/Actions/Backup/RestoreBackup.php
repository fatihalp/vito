<?php

namespace App\Actions\Backup;

use App\DTOs\SocketEventDTO;
use App\Enums\BackupFileStatus;
use App\Enums\BackupType;
use App\Enums\DatabaseStatus;
use App\Events\SocketEvent;
use App\Http\Resources\BackupFileResource;
use App\Jobs\Backup\RestoreDatabaseJob;
use App\Models\BackupFile;
use App\Models\Database;
use Closure;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RestoreBackup
{

    public function restore(BackupFile $backupFile, array $input): void
    {
        DB::transaction(function () use ($backupFile, $input): void {
            $lockedFile = BackupFile::query()->lockForUpdate()->findOrFail($backupFile->id);
            $this->restoreLocked($lockedFile, $input);
        });
    }

    private function restoreLocked(BackupFile $backupFile, array $input): void
    {
        if ($backupFile->backup->type !== BackupType::DATABASE) {
            throw ValidationException::withMessages([
                'backup' => __('Only database dump backups can be restored here.'),
            ]);
        }

        if (! $backupFile->isAvailable() || $backupFile->status === BackupFileStatus::RESTORING) {
            throw ValidationException::withMessages([
                'backup' => __('This backup file cannot be restored in its current state.'),
            ]);
        }

        $this->validate($backupFile, $input);

        $backup = $backupFile->backup;
        $backupFile->status = BackupFileStatus::RESTORING;
        $backupFile->message = null;

        $this->restoreDatabase($backupFile, $input);

        app(BroadcastBackupUpdate::class)->broadcast($backup);
    }

    private function restoreDatabase(BackupFile $backupFile, array $input): void
    {
        $database = Database::query()->with('server')->findOrFail($input['database']);
        Gate::authorize('update', $database);
        $backupFile->restored_to = $database->server_id === $backupFile->backup->server_id
            ? $database->name
            : "{$database->name} ({$database->server->name})";
        $backupFile->save();
        $this->broadcastFileUpdate($backupFile);

        dispatch(new RestoreDatabaseJob($backupFile, $database))->onQueue('ssh')->afterCommit();
    }

    private function broadcastFileUpdate(BackupFile $backupFile): void
    {
        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $backupFile->backup->server->project_id,
            type: 'backup-file.updated',
            data: new BackupFileResource($backupFile),
        ));
    }

    public function validate(BackupFile $backupFile, array $input): void
    {
        $rules = [
            'database' => [
                'required',
                Rule::exists('databases', 'id')
                    ->whereNull('deleted_at')
                    ->whereIn('server_id', $backupFile->backup->server->project->servers()->pluck('id')->all()),
                function (string $attribute, mixed $value, Closure $fail) use ($backupFile): void {

                    $database = Database::query()->with('server')->find($value);
                    if (! $database) {
                        return;
                    }

                    if ($database->server->project_id !== $backupFile->backup->server->project_id) {
                        $fail('The selected database does not belong to this project.');

                        return;
                    }

                    if (! $database->server->isReady()) {
                        $fail('The selected server is not ready.');

                        return;
                    }

                    if ($database->status !== DatabaseStatus::READY) {
                        $fail('The selected database is not ready.');

                        return;
                    }

                    $error = $backupFile->restoreCompatibilityError($database);
                    if ($error !== null) {
                        $fail($error);
                    }
                },
            ],
        ];

        Validator::make($input, $rules)->validate();
    }
}
