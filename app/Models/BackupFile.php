<?php

namespace App\Models;

use App\Actions\Backup\ManageBackupFile;
use App\Enums\BackupFileStatus;
use App\Enums\BackupType;
use App\Enums\StorageMigrationItemStatus;
use App\Enums\StorageMigrationStatus;
use App\Facades\Notifier;
use App\Notifications\FailedToDeleteBackupFileFromProvider;
use App\StorageProviders\Dropbox;
use App\StorageProviders\FTP;
use App\StorageProviders\Local;
use App\StorageProviders\S3;
use App\StorageProviders\SFTP;
use Database\Factories\BackupFileFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;
use Throwable;

class BackupFile extends AbstractModel
{
    
    use HasFactory;

    protected $fillable = [
        'backup_id',
        'name',
        'size',
        'status',
        'restored_to',
        'restored_at',
        'progress',
        'server_id',
        'type',
        'database_size',
    ];

    protected $casts = [
        'backup_id' => 'integer',
        'progress' => 'float',
        'server_id' => 'integer',
        'restored_at' => 'datetime',
        'status' => BackupFileStatus::class,
        'database_size' => 'integer',
    ];

    protected static function booted(): void
    {
        static::created(function (BackupFile $backupFile): void {
            if ($backupFile->backup->type === BackupType::PGBACKREST) {
                return;
            }

            $keep = $backupFile->backup->keep_backups;
            if ($backupFile->backup->files()->count() > $keep) {
                
                $lastFileToKeep = $backupFile->backup->files()->orderByDesc('id')->skip($keep)->first();
                if ($lastFileToKeep) {
                    $files = $backupFile->backup->files()
                        ->where('id', '<=', $lastFileToKeep->id)
                        ->get();
                    
                    foreach ($files as $file) {
                        app(ManageBackupFile::class)->delete($file);
                    }
                }
            }
        });
    }

    public function isAvailable(): bool
    {
        return ! in_array(
            $this->status,
            [
                BackupFileStatus::CREATING,
                BackupFileStatus::FAILED,
                BackupFileStatus::DELETING,
                BackupFileStatus::DELETE_FAILED,
            ]
        );
    }

    public function isLocal(): bool
    {
        return $this->backup->storage->provider === Local::id();
    }

    public static function normalizeVersion(?string $raw): ?string
    {
        if ($raw === null || ! preg_match('/\d+(\.\d+){0,2}/', trim($raw), $matches)) {
            return null;
        }

        return $matches[0];
    }

    public function restoreCompatibilityError(Database $target): ?string
    {
        $targetServer = $target->server;

        if ($targetServer->id === $this->backup->server_id) {
            return null;
        }

        if ($this->isLocal()) {
            return 'Backups on local storage can only be restored to their original server.';
        }

        if (! $this->database_engine || ! $this->database_version) {
            return 'This backup file has no source database metadata and can only be restored to its original server.';
        }

        $service = $targetServer->database();
        if (! $service) {
            return 'The selected server has no database service.';
        }

        if ($service->name !== $this->database_engine) {
            return "The backup was taken from {$this->database_engine} and cannot be restored to a server running {$service->name}.";
        }

        $targetVersion = static::normalizeVersion($service->installed_version ?: $service->version);
        if ($targetVersion === null) {
            return "Cannot determine the target server's database version.";
        }

        if (! static::versionGte($targetVersion, $this->database_version)) {
            return "The target database version ({$targetVersion}) is lower than the backup source version ({$this->database_version}).";
        }

        return null;
    }

    public static function versionGte(string $target, string $source): bool
    {
        $targetParts = explode('.', $target);
        $sourceParts = explode('.', $source);
        $length = min(count($targetParts), count($sourceParts));

        return version_compare(
            implode('.', array_slice($targetParts, 0, $length)),
            implode('.', array_slice($sourceParts, 0, $length)),
            '>='
        );
    }


    public function backup(): BelongsTo
    {
        return $this->belongsTo(Backup::class);
    }

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    public function activeMigrationItem(): ?StorageMigrationItem
    {
        $storageMigrations = StorageMigration::query()
            ->where('target_storage_id', $this->backup->storage_id)
            ->where('status', '!=', StorageMigrationStatus::COMPLETED)
            ->whereNotNull('started_at')
            ->with('source')
            ->latest('id')
            ->get();

        foreach ($storageMigrations as $storageMigration) {
            try {
                $item = $storageMigration->items()->where('backup_file_id', $this->id)->first();
            } catch (Throwable $e) {
                if ($this->created_at?->gt($storageMigration->started_at)) {
                    continue;
                }

                throw $e;
            }

            if ($item) {
                return in_array($item->status, [StorageMigrationItemStatus::COPIED, StorageMigrationItemStatus::SKIPPED], true)
                    ? null
                    : $item->setRelation('storageMigration', $storageMigration);
            }
        }

        return null;
    }

    public function tempPath(?Server $server = null): string
    {
        $extension = $this->getBackupExtension();

        return '/home/'.($server ?? $this->backup->server)->getSshUser().'/'.$this->name.$extension;
    }

    public function path(?StorageProvider $storage = null): string
    {
        $storage ??= $this->backup->storage;


        $backupName = $this->backup->type === BackupType::FILE
            ? basename($this->backup->path)
            : $this->backup->database->name;

        $extension = $this->getBackupExtension();

        return match ($storage->provider) {
            Dropbox::id() => '/'.$backupName.'/'.$this->name.$extension,
            S3::id(), FTP::id(), SFTP::id(), Local::id() => implode('/', [
                rtrim((string) $storage->credentials['path'], '/'),
                $backupName,
                $this->name.$extension,
            ]),
            default => '',
        };
    }

    public function currentStorage(): StorageProvider
    {
        $item = $this->activeMigrationItem();

        return $item ? $item->storageMigration->source : $this->backup->storage;
    }

    public function currentPath(): string
    {
        $item = $this->activeMigrationItem();

        return $item ? $item->source_key : $this->path();
    }

    public function deleteFile(): void
    {
        if ($this->backup->type === BackupType::PGBACKREST) {
            $this->delete();

            return;
        }

        try {
            $storage = $this->currentStorage()->provider()->ssh($this->backup->server);
            $storage->delete($this->currentPath());
        } catch (Throwable $e) {
            $this->status = BackupFileStatus::DELETE_FAILED;
            $this->message = Str::limit($e->getMessage(), 1000);
            $this->save();
            Notifier::send($this->backup->server, new FailedToDeleteBackupFileFromProvider($this));

            return;
        }

        $this->delete();
    }

    private function getBackupExtension(): string
    {
        if ($this->backup->type === BackupType::DATABASE) {
            return '.sql.gz';
        }

        return '.tar.gz';
    }
}
