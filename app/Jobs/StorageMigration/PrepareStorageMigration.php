<?php

namespace App\Jobs\StorageMigration;

use App\Actions\Backup\ManagePgBackRest;
use App\Actions\StorageMigration\BroadcastStorageMigrationUpdate;
use App\Actions\StorageMigration\ManageStorageMigration;
use App\Actions\StorageMigration\ManageStorageMigrationDatabase;
use App\Enums\BackupType;
use App\Enums\StorageMigrationItemStatus;
use App\Enums\StorageMigrationStatus;
use App\Models\Backup;
use App\Models\BackupFile;
use App\Models\StorageMigration;
use App\Models\StorageProvider;
use App\StorageProviders\S3;
use App\Support\S3ObjectCopier;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

class PrepareStorageMigration implements ShouldQueue
{
    use Queueable;
    use UniqueQueue {
        isTransientDatabaseError as isConcurrencyError;
    }

    public int $timeout;

    public function __construct(protected StorageMigration $storageMigration)
    {
        $this->timeout = (int) config('storage-migration.scan_timeout', 21600);
        $this->onConnection('storage-migration-scan');
    }

    protected function lockSeconds(): int
    {
        return $this->timeout + 60;
    }

    protected function isTransientDatabaseError(Throwable $e): bool
    {
        if (ManageStorageMigrationDatabase::unreachable($e)) {
            ManageStorageMigrationDatabase::forgetAccessCheck($this->storageMigration);

            return true;
        }

        return $this->isConcurrencyError($e);
    }

    public function handle(): void
    {
        $this->run("storage-migration-{$this->storageMigration->id}", function (): void {
            $this->storageMigration->refresh();

            if (! $this->storageMigration->status->isActive() || $this->storageMigration->scan_paused || $this->storageMigration->scan_completed_at !== null) {
                return;
            }

            if (! app(ManageStorageMigrationDatabase::class)->ready($this->storageMigration)) {
                dispatch(new self($this->storageMigration))
                    ->onQueue(config('storage-migration.scan_queue'))
                    ->delay(now()->addSeconds((int) config('storage-migration.scan_wait_delay', 5)));

                return;
            }

            $backups = $this->matchingBackups();
            $backupFiles = $this->backupFilesByKey($backups);

            $this->trackBackupFiles($backupFiles);
            $this->cutoverKnownBackups($backups);

            if ($this->storageMigration->target_scan_completed_at === null && ! $this->inventoryTarget()) {
                return;
            }

            $this->scanSource($backupFiles);
        });
    }

    public function failed(Exception $e): void
    {
        StorageMigration::whereKey($this->storageMigration->id)->update([
            'status' => StorageMigrationStatus::FAILED->value,
            'error' => Str::limit($e->getMessage(), 1000),
            'finished_at' => now(),
        ]);

        app(BroadcastStorageMigrationUpdate::class)->broadcast($this->storageMigration);
    }

    private function cutoverKnownBackups(Collection $backups): void
    {
        DB::transaction(function () use ($backups): void {
            foreach ($backups as $backup) {
                $backup->storage_id = $this->storageMigration->target_storage_id;
                $backup->save();
            }
        });

        $backups
            ->filter(fn (Backup $backup): bool => $backup->type === BackupType::PGBACKREST)
            ->each(fn (Backup $backup) => app(ManagePgBackRest::class)->reinstall($backup));
    }

    /**
     * @param  array<string, BackupFile>  $backupFiles
     */
    private function trackBackupFiles(array $backupFiles): void
    {
        StorageMigration::whereKey($this->storageMigration->id)->whereNull('started_at')->update(['started_at' => now()]);
        $this->storageMigration->refresh();

        $now = now();
        $rows = [];

        foreach ($backupFiles as $key => $file) {
            if ($file->isAvailable()) {
                $rows[] = $this->itemRow($key, null, $file->id, $now);
            }
        }

        foreach (array_chunk($rows, 500) as $chunk) {
            $existing = $this->storageMigration->items()
                ->whereIn('source_key_hash', array_column($chunk, 'source_key_hash'))
                ->pluck('source_key_hash')
                ->flip();
            $newRows = array_values(array_filter($chunk, fn (array $row): bool => ! $existing->has($row['source_key_hash'])));

            $this->storageMigration->items()->insertOrIgnore($newRows);
            StorageMigration::whereKey($this->storageMigration->id)->increment('items_total', count($newRows));
        }
    }

    /**
     * Lists what already exists under the target path once, so transfers can skip or refuse existing objects without a
     * request per object. Returns false when the migration was paused or cancelled meanwhile.
     */
    private function inventoryTarget(): bool
    {
        StorageMigration::whereKey($this->storageMigration->id)
            ->where('status', StorageMigrationStatus::PENDING)
            ->update(['status' => StorageMigrationStatus::SCANNING]);

        $target = $this->storageMigration->target;
        $provider = new S3($target);
        $provider->buildClientConfig();
        $client = $provider->getClient();
        $bucket = trim((string) $target->credentials['bucket']);
        $prefix = $this->prefix($target);
        $copier = app(S3ObjectCopier::class);
        $pageSize = (int) config('storage-migration.list_page_size', 1000);
        $token = $this->storageMigration->target_cursor;

        do {
            $this->storageMigration->refresh();

            if (! $this->storageMigration->status->isActive() || $this->storageMigration->scan_paused) {
                return false;
            }

            $page = $copier->listPage($client, $bucket, $prefix !== '' ? $prefix.'/' : '', $token, $pageSize);
            $this->storageMigration->targets()->insertOrIgnore(array_map(
                fn (array $object): array => ['key_hash' => sha1($object['key']), 'size' => $object['size']],
                $page['objects'],
            ));
            $token = $page['nextToken'];

            StorageMigration::whereKey($this->storageMigration->id)->update([
                'target_cursor' => $token,
                'target_scan_completed_at' => $token === null ? now() : null,
                'last_activity_at' => now(),
            ]);
        } while ($token !== null);

        $this->storageMigration->refresh();

        return true;
    }

    /**
     * @param  array<string, BackupFile>  $backupFiles
     */
    private function scanSource(array $backupFiles): void
    {
        StorageMigration::whereKey($this->storageMigration->id)
            ->whereIn('status', [StorageMigrationStatus::PENDING, StorageMigrationStatus::SCANNING])
            ->update([
                'status' => StorageMigrationStatus::SCANNING,
                'started_at' => $this->storageMigration->started_at ?? now(),
            ]);
        app(BroadcastStorageMigrationUpdate::class)->broadcast($this->storageMigration);

        app(ManageStorageMigration::class)->dispatchTransfers($this->storageMigration);

        $sourceStorage = $this->storageMigration->source;

        $sourceProvider = new S3($sourceStorage);
        $sourceProvider->buildClientConfig();
        $sourceClient = $sourceProvider->getClient();
        $sourceBucket = trim((string) $sourceStorage->credentials['bucket']);
        $sourcePrefix = $this->prefix($sourceStorage);
        $repositories = $this->pgBackRestRepositories($sourcePrefix);

        $copier = app(S3ObjectCopier::class);
        $pageSize = (int) config('storage-migration.list_page_size', 1000);
        $token = $this->storageMigration->scan_cursor;

        do {
            $this->storageMigration->refresh();

            if (! $this->storageMigration->status->isActive() || $this->storageMigration->scan_paused) {
                return;
            }

            $page = $copier->listPage($sourceClient, $sourceBucket, $sourcePrefix !== '' ? $sourcePrefix.'/' : '', $token, $pageSize);

            $now = now();
            $objects = array_filter($page['objects'], fn (array $object): bool => ! Str::startsWith($object['key'], $repositories));
            $rows = array_map(
                fn (array $object): array => $this->itemRow($object['key'], $object['size'], $backupFiles[$object['key']]->id ?? null, $now),
                array_values($objects),
            );

            $existing = $this->storageMigration->items()
                ->whereIn('source_key_hash', array_column($rows, 'source_key_hash'))
                ->pluck('size', 'source_key_hash');
            $newRows = array_values(array_filter($rows, fn (array $row): bool => ! $existing->has($row['source_key_hash'])));
            $this->storageMigration->items()->insertOrIgnore($newRows);

            $sizedRows = array_filter($rows, fn (array $row): bool => $existing->has($row['source_key_hash']) && $existing[$row['source_key_hash']] === null);
            foreach ($sizedRows as $row) {
                $this->storageMigration->items()
                    ->where('source_key_hash', $row['source_key_hash'])
                    ->whereNull('size')
                    ->update(['size' => $row['size']]);
            }

            StorageMigration::whereKey($this->storageMigration->id)->incrementEach([
                'items_total' => count($newRows),
                'bytes_total' => array_sum(array_column($newRows, 'size')) + array_sum(array_column($sizedRows, 'size')),
            ], [
                'scan_cursor' => $page['nextToken'],
                'scan_completed_at' => $page['nextToken'] === null ? now() : null,
                'last_activity_at' => now(),
            ]);
            app(BroadcastStorageMigrationUpdate::class)->broadcast($this->storageMigration);

            $token = $page['nextToken'];
        } while ($token !== null);

        $status = StorageMigration::whereKey($this->storageMigration->id)->value('status');

        if (in_array($status, [StorageMigrationStatus::PAUSED->value, StorageMigrationStatus::CANCELLED->value], true)) {
            return;
        }

        StorageMigration::whereKey($this->storageMigration->id)
            ->where('status', StorageMigrationStatus::SCANNING->value)
            ->update([
                'status' => $this->storageMigration->fresh()->transfer_paused ? StorageMigrationStatus::PAUSED->value : StorageMigrationStatus::RUNNING->value,
                'scan_completed_at' => now(),
                'finished_at' => null,
            ]);

        app(BroadcastStorageMigrationUpdate::class)->broadcast($this->storageMigration);
    }

    /**
     * @return array<string, mixed>
     */
    private function itemRow(string $sourceKey, ?int $size, ?int $backupFileId, Carbon $now): array
    {
        return [
            'backup_file_id' => $backupFileId,
            'source_key' => $sourceKey,
            'source_key_hash' => sha1($sourceKey),
            'target_key' => $this->targetKeyFor($sourceKey, $this->prefix($this->storageMigration->source), $this->prefix($this->storageMigration->target)),
            'size' => $size,
            'status' => StorageMigrationItemStatus::PENDING->value,
            'attempts' => 0,
            'created_at' => $now,
            'updated_at' => $now,
        ];
    }

    private function prefix(StorageProvider $storage): string
    {
        return trim((string) ($storage->credentials['path'] ?? ''), '/');
    }

    /**
     * @return list<string>
     */
    private function pgBackRestRepositories(string $sourcePrefix): array
    {
        return Backup::query()
            ->where('type', BackupType::PGBACKREST)
            ->whereIn('storage_id', [$this->storageMigration->source_storage_id, $this->storageMigration->target_storage_id])
            ->whereHas('server', fn ($query) => $query->where('project_id', $this->storageMigration->project_id))
            ->with('cluster')
            ->get()
            ->filter(fn (Backup $backup): bool => $backup->cluster !== null)
            ->map(fn (Backup $backup): string => ltrim($sourcePrefix.'/pgbackrest/'.$backup->cluster->stanza.'/', '/'))
            ->values()
            ->all();
    }

    private function targetKeyFor(string $sourceKey, string $sourcePrefix, string $targetPrefix): string
    {
        $relative = $sourcePrefix !== '' && str_starts_with($sourceKey, $sourcePrefix.'/')
            ? substr($sourceKey, strlen($sourcePrefix) + 1)
            : $sourceKey;

        return $targetPrefix !== '' ? $targetPrefix.'/'.$relative : $relative;
    }

    /**
     * @return array<string, BackupFile>
     */
    private function backupFilesByKey(Collection $backups): array
    {
        $map = [];

        foreach ($backups as $backup) {
            if ($backup->type === BackupType::PGBACKREST || ($backup->type === BackupType::DATABASE && $backup->database === null)) {
                continue;
            }

            foreach ($backup->files as $file) {
                $file->setRelation('backup', $backup);
                $map[ltrim($file->path($this->storageMigration->source), '/')] = $file;
            }
        }

        return $map;
    }

    private function matchingBackups(): Collection
    {
        return Backup::query()
            ->whereHas('server', fn ($query) => $query->where('project_id', $this->storageMigration->project_id))
            ->where('storage_id', $this->storageMigration->source_storage_id)
            ->with('files', 'database')
            ->get();
    }
}
