<?php

namespace App\Actions\Backup;

use App\DTOs\SocketEventDTO;
use App\Enums\BackupFileStatus;
use App\Enums\BackupType;
use App\Events\SocketEvent;
use App\Http\Resources\BackupFileResource;
use App\Jobs\Backup\DeleteFileJob;
use App\Models\BackupFile;
use App\Models\Server;
use App\SSH\Storage\S3 as S3Storage;
use App\StorageProviders\S3;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class ManageBackupFile
{
    public function delete(BackupFile $file): void
    {
        $server = Server::find($file->backup->server_id);

        if ($server === null) {
            Log::warning('Deleting orphaned backup file without a server', [
                'backup_file_id' => $file->id,
                'backup_id' => $file->backup_id,
            ]);
            $file->delete();

            return;
        }

        $file->status = BackupFileStatus::DELETING;
        $file->message = null;
        $file->save();

        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $server->project_id,
            type: 'backup-file.updated',
            data: new BackupFileResource($file),
        ));

        dispatch(new DeleteFileJob($file))->onQueue('ssh');
    }

    public function downloadUrl(BackupFile $file): string
    {
        $storage = $file->currentStorage();
        $provider = $storage->provider();

        if (! $file->isAvailable() || ! $provider instanceof S3 || $file->backup->type === BackupType::PGBACKREST) {
            throw ValidationException::withMessages([
                'file' => __('Only available backup files stored on S3 can be downloaded.'),
            ]);
        }

        $key = S3Storage::prepareS3Path($file->currentPath());

        return $provider->presignedUrl($storage->credentials, $key, '+5 minutes', [
            'ResponseContentDisposition' => 'attachment; filename="'.basename($key).'"',
        ]);
    }
}
