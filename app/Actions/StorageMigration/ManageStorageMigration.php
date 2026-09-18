<?php

namespace App\Actions\StorageMigration;

use App\Enums\StorageMigrationItemStatus;
use App\Exceptions\SSHError;
use App\Enums\StorageMigrationStatus;
use App\Jobs\StorageMigration\CopyStorageMigrationItems;
use App\Jobs\StorageMigration\PrepareStorageMigration;
use App\Models\BackupFile;
use App\Models\Project;
use App\Models\StorageMigration;
use App\Models\StorageProvider;
use App\Models\User;
use App\StorageProviders\S3;
use Closure;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ManageStorageMigration
{
    public function create(Project $project, User $user, array $input): StorageMigration
    {
        $this->validate($project, $user, $input);

        $source = StorageProvider::findOrFail($input['source_storage_id']);
        $target = StorageProvider::findOrFail($input['target_storage_id']);

        $storageMigration = new StorageMigration([
            'name' => $input['name'],
            'project_id' => $project->id,
            'source_storage_id' => $source->id,
            'target_storage_id' => $target->id,
            'overwrite' => $input['overwrite'] ?? false,
            'status' => StorageMigrationStatus::PENDING,
            ...app(ManageStorageMigrationDatabase::class)->connect($project, $input),
        ]);
        $storageMigration->save();

        dispatch(new PrepareStorageMigration($storageMigration))->onQueue(config('storage-migration.scan_queue'));

        return $storageMigration;
    }

    public function update(StorageMigration $storageMigration, array $input): void
    {
        $storageMigration->update(Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
        ])->validate());

        app(BroadcastStorageMigrationUpdate::class)->broadcast($storageMigration);
    }

    public function delete(StorageMigration $storageMigration): void
    {
        $this->withScanDatabase($storageMigration, function () use ($storageMigration): void {
            if ($this->hasUncopiedBackupFiles($storageMigration)) {
                throw ValidationException::withMessages([
                    'status' => __('Some backup files still exist only on the source storage. Retry the failed items before deleting this migration.'),
                ]);
            }

            app(ManageStorageMigrationDatabase::class)->disconnect($storageMigration);
        });

        $storageMigration->delete();
    }

    /**
     * Runs work that needs the scan database and turns an unreachable database into a message the admin can act on.
     */
    private function withScanDatabase(StorageMigration $storageMigration, Closure $callback): mixed
    {
        $server = $storageMigration->database?->server;

        if ($server !== null) {
            try {
                $ready = app(ManageStorageMigrationDatabase::class)->refreshAccess($storageMigration);
            } catch (SSHError $e) {
                throw ValidationException::withMessages([
                    'status' => __('Vito cannot reach the scan database server :server over SSH: :error', ['server' => $server->name, 'error' => $e->getMessage()]),
                ]);
            }

            if (! $ready) {
                throw ValidationException::withMessages([
                    'status' => __('Vito now connects from a different IP address, so it is updating the firewall of the scan database on :server. Try again in a minute.', ['server' => $server->name]),
                ]);
            }
        }

        try {
            return $callback();
        } catch (QueryException $e) {
            if (! ManageStorageMigrationDatabase::unreachable($e)) {
                throw $e;
            }

            ManageStorageMigrationDatabase::forgetAccessCheck($storageMigration);

            throw ValidationException::withMessages([
                'status' => __('Vito cannot reach the scan database on :server. Check that PostgreSQL or MySQL is running there and that its firewall allows Vito, then try again.', ['server' => $server?->name ?? __('the Vito server')]),
            ]);
        }
    }

    public function updateWorkers(StorageMigration $storageMigration, array $input): void
    {
        $validated = Validator::make($input, [
            'worker_count' => ['required', 'integer', 'min:1', 'max:'.config('storage-migration.max_allowed_processes', 10)],
        ])->validate();

        if (! $storageMigration->status->isOpen()) {
            throw ValidationException::withMessages(['worker_count' => __('This migration has already finished.')]);
        }

        $storageMigration->update($validated);
        $this->dispatchTransfers($storageMigration);
        app(BroadcastStorageMigrationUpdate::class)->broadcast($storageMigration);
    }

    public function dispatchTransfers(StorageMigration $storageMigration): void
    {
        $storageMigration->refresh();
        if (! $storageMigration->status->isActive() || $storageMigration->transfer_paused) {
            return;
        }

        StorageMigration::whereKey($storageMigration->id)->increment('transfer_generation');
        $storageMigration->refresh();

        for ($slot = 0; $slot < $storageMigration->worker_count; $slot++) {
            dispatch(new CopyStorageMigrationItems($storageMigration, workerSlot: $slot, generation: $storageMigration->transfer_generation))->onQueue(config('storage-migration.queue'));
        }
    }

    public function pause(StorageMigration $storageMigration, array $input = []): void
    {
        $this->controlPhase($storageMigration, $input, true);
    }

    public function resume(StorageMigration $storageMigration, array $input = []): void
    {
        $this->controlPhase($storageMigration, $input, false);
    }

    private function controlPhase(StorageMigration $storageMigration, array $input, bool $paused): void
    {
        $validated = Validator::make($input, [
            'phase' => ['sometimes', 'required', Rule::in(['scan', 'transfer', 'all'])],
        ])->validate();
        $phase = $validated['phase'] ?? 'all';

        DB::transaction(function () use ($storageMigration, $phase, $paused): void {
            $migration = StorageMigration::query()->lockForUpdate()->findOrFail($storageMigration->id);

            if (! $migration->status->isOpen() || ($phase === 'scan' && $migration->scan_completed_at !== null)) {
                throw ValidationException::withMessages([
                    'phase' => __('This phase has already finished.'),
                ]);
            }

            if ($phase !== 'transfer') {
                $migration->scan_paused = $paused;
            }
            if ($phase !== 'scan') {
                $migration->transfer_paused = $paused;
            }

            $migration->status = $migration->transfer_paused && ($migration->scan_paused || $migration->scan_completed_at !== null)
                ? StorageMigrationStatus::PAUSED
                : ($migration->scan_completed_at === null ? StorageMigrationStatus::SCANNING : StorageMigrationStatus::RUNNING);
            $migration->save();
        });

        $storageMigration->refresh();
        app(BroadcastStorageMigrationUpdate::class)->broadcast($storageMigration);

        if (! $paused) {
            if (! $storageMigration->scan_paused && $storageMigration->scan_completed_at === null) {
                dispatch(new PrepareStorageMigration($storageMigration))->onQueue(config('storage-migration.scan_queue'));
            }
            if (! $storageMigration->transfer_paused) {
                $this->dispatchTransfers($storageMigration);
            }
        }
    }

    public function cancel(StorageMigration $storageMigration): void
    {
        if (! $storageMigration->status->isOpen()) {
            throw ValidationException::withMessages([
                'status' => __('This migration has already finished.'),
            ]);
        }

        $this->withScanDatabase($storageMigration, fn () => $storageMigration->items()
            ->where('status', StorageMigrationItemStatus::PROCESSING)
            ->update(['status' => StorageMigrationItemStatus::PENDING]));

        StorageMigration::whereKey($storageMigration->id)->update([
            'status' => StorageMigrationStatus::CANCELLED->value,
            'finished_at' => now(),
        ]);

        app(BroadcastStorageMigrationUpdate::class)->broadcast($storageMigration);
    }

    public function retryFailed(StorageMigration $storageMigration): void
    {
        if (! in_array($storageMigration->status, [StorageMigrationStatus::PARTIAL, StorageMigrationStatus::FAILED], true)) {
            throw ValidationException::withMessages([
                'status' => __('Only a partially failed migration can be retried.'),
            ]);
        }

        $this->withScanDatabase($storageMigration, fn () => $storageMigration->items()
            ->where('status', StorageMigrationItemStatus::FAILED)
            ->update([
                'status' => StorageMigrationItemStatus::PENDING,
                'attempts' => 0,
                'error' => null,
            ]));

        $rescan = $storageMigration->scan_completed_at === null;

        StorageMigration::whereKey($storageMigration->id)->update([
            'items_failed' => 0,
            'status' => $rescan ? StorageMigrationStatus::SCANNING->value : StorageMigrationStatus::RUNNING->value,
            'scan_paused' => false,
            'transfer_paused' => false,
            'error' => null,
            'finished_at' => null,
        ]);

        app(BroadcastStorageMigrationUpdate::class)->broadcast($storageMigration);

        if ($rescan) {
            dispatch(new PrepareStorageMigration($storageMigration))->onQueue(config('storage-migration.scan_queue'));

            return;
        }

        $this->dispatchTransfers($storageMigration);
    }

    private function hasUncopiedBackupFiles(StorageMigration $storageMigration): bool
    {
        if ($storageMigration->started_at === null || ($storageMigration->database_id !== null && ! $storageMigration->database?->server?->database())) {
            return false;
        }

        return $storageMigration->items()
            ->whereNotNull('backup_file_id')
            ->whereNotIn('status', [StorageMigrationItemStatus::COPIED, StorageMigrationItemStatus::SKIPPED])
            ->pluck('backup_file_id')
            ->chunk(1000)
            ->contains(fn ($ids): bool => BackupFile::query()->whereIn('id', $ids->all())->exists());
    }

    private function validate(Project $project, User $user, array $input): void
    {
        Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'source_storage_id' => [
                'required',
                'different:target_storage_id',
                Rule::exists('storage_providers', 'id'),
            ],
            'target_storage_id' => [
                'required',
                Rule::exists('storage_providers', 'id'),
            ],
            'overwrite' => ['sometimes', 'boolean'],
        ])->validate();

        $source = StorageProvider::findOrFail($input['source_storage_id']);
        $target = StorageProvider::findOrFail($input['target_storage_id']);

        foreach (['source_storage_id' => $source, 'target_storage_id' => $target] as $field => $provider) {
            if ($provider->user_id !== $user->id) {
                throw ValidationException::withMessages([
                    $field => __('You do not have access to the selected storage provider.'),
                ]);
            }

            if ($provider->provider !== S3::id()) {
                throw ValidationException::withMessages([
                    $field => __('Only S3-compatible storage providers can be migrated.'),
                ]);
            }
        }

        if (! $source->provider()->canRead($source->credentials)) {
            throw ValidationException::withMessages([
                'source_storage_id' => __('Could not verify read access to this storage provider.'),
            ]);
        }

        if (! $target->provider()->connect($target->credentials)) {
            throw ValidationException::withMessages([
                'target_storage_id' => __('Could not verify write access to this storage provider.'),
            ]);
        }

        $hasOpenMigration = StorageMigration::query()
            ->where('source_storage_id', $source->id)
            ->where('target_storage_id', $target->id)
            ->get()
            ->contains(fn (StorageMigration $storageMigration): bool => $storageMigration->status->isOpen());

        if ($hasOpenMigration) {
            throw ValidationException::withMessages([
                'source_storage_id' => __('A migration between these providers is already in progress.'),
            ]);
        }
    }
}
