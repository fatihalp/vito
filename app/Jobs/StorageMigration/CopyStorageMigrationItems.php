<?php

namespace App\Jobs\StorageMigration;

use App\Actions\StorageMigration\BroadcastStorageMigrationUpdate;
use App\Actions\StorageMigration\ManageStorageMigrationDatabase;
use App\Enums\StorageMigrationItemStatus;
use App\Enums\StorageMigrationStatus;
use App\Exceptions\StorageMigrationObjectMissing;
use App\Facades\Notifier;
use App\Models\StorageMigration;
use App\Models\StorageMigrationItem;
use App\Models\StorageProvider;
use App\Notifications\StorageMigrationFailed;
use App\StorageProviders\S3;
use App\Support\S3ObjectCopier;
use App\Traits\UniqueQueue;
use Aws\S3\S3Client;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Throwable;

class CopyStorageMigrationItems implements ShouldQueue
{
    use Queueable;
    use UniqueQueue {
        isTransientDatabaseError as isConcurrencyError;
    }

    public int $timeout;

    private int $workerSlot = 0;

    private S3ObjectCopier $copier;

    private S3Client $sourceClient;

    private string $sourceBucket;

    private S3Client $targetClient;

    private string $targetBucket;

    private ?int $activityRecordedAt = null;

    public function __construct(
        protected StorageMigration $storageMigration,
        private readonly int $verifyPass = 0,
        private readonly ?int $verifyCursor = null,
        private readonly int $verifyRepairedSoFar = 0,
        private readonly int $nextVerifyPass = 1,
        int $workerSlot = 0,
        private readonly int $generation = 0,
        private readonly ?string $verifyToken = null,
        private readonly bool $verifyListing = false,
    ) {
        $this->timeout = (int) config('storage-migration.job_timeout', 1800);
        $this->workerSlot = $workerSlot;
        $this->onConnection('storage-migration');
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
        $this->run("storage-migration-copy-{$this->storageMigration->id}-{$this->workerSlot}", function (): void {
            $this->storageMigration->refresh();

            if (! $this->storageMigration->status->isActive() || $this->storageMigration->transfer_paused || $this->workerSlot >= $this->storageMigration->worker_count) {
                return;
            }

            if ($this->verifyPass === 0 && $this->generation !== $this->storageMigration->transfer_generation) {
                return;
            }

            if ($this->verifyPass > 0 && $this->storageMigration->status !== StorageMigrationStatus::VERIFYING) {
                return;
            }
            if ($this->verifyPass === 0 && $this->storageMigration->status === StorageMigrationStatus::VERIFYING) {
                return;
            }

            if (! app(ManageStorageMigrationDatabase::class)->ready($this->storageMigration)) {
                dispatch(new self($this->storageMigration, $this->verifyPass, $this->verifyCursor, $this->verifyRepairedSoFar, $this->nextVerifyPass, $this->workerSlot, $this->generation, $this->verifyToken, $this->verifyListing))
                    ->onQueue(config('storage-migration.queue'))
                    ->delay(now()->addSeconds((int) config('storage-migration.scan_wait_delay', 5)));

                return;
            }

            $this->initClients();

            if ($this->verifyPass === 0) {
                $this->runCopyCycle();
            } else {
                $this->runVerifyCycle();
            }
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
        Notifier::send($this->storageMigration, new StorageMigrationFailed($this->storageMigration));
    }

    private function runCopyCycle(): void
    {
        $this->storageMigration->refresh();

        if (! $this->storageMigration->status->isActive() || $this->storageMigration->transfer_paused || $this->workerSlot >= $this->storageMigration->worker_count) {
            return;
        }

        $batch = $this->storageMigration->target_scan_completed_at === null && $this->storageMigration->scan_completed_at === null
            ? collect()
            : $this->claimBatch();

        if ($batch->isNotEmpty()) {
            $known = $this->storageMigration->target_scan_completed_at === null ? null : $this->storageMigration->targets()
                ->whereIn('key_hash', $batch->map(fn (StorageMigrationItem $item): string => sha1($item->target_key))->all())
                ->pluck('size', 'key_hash');

            foreach ($batch as $item) {
                if (! $this->storageMigration->fresh()->status->isActive() || $this->storageMigration->fresh()->transfer_paused || $this->workerSlot >= $this->storageMigration->fresh()->worker_count) {
                    $this->storageMigration->items()
                        ->where('status', StorageMigrationItemStatus::PROCESSING)
                        ->where('worker_slot', $this->workerSlot)
                        ->update(['status' => StorageMigrationItemStatus::PENDING]);

                    break;
                }

                $this->processItem($item, $known);
                app(BroadcastStorageMigrationUpdate::class)->broadcast($this->storageMigration);
            }

            app(BroadcastStorageMigrationUpdate::class)->broadcast($this->storageMigration);

            dispatch(new self($this->storageMigration, nextVerifyPass: $this->nextVerifyPass, workerSlot: $this->workerSlot, generation: $this->generation))->onQueue(config('storage-migration.queue'));

            return;
        }

        $this->storageMigration->refresh();

        if (! $this->storageMigration->status->isActive() || $this->storageMigration->transfer_paused || $this->workerSlot >= $this->storageMigration->worker_count) {
            return;
        }

        if ($this->storageMigration->scan_completed_at === null
            || $this->storageMigration->items()->whereIn('status', [StorageMigrationItemStatus::PENDING, StorageMigrationItemStatus::PROCESSING])->exists()) {
            dispatch(new self($this->storageMigration, nextVerifyPass: $this->nextVerifyPass, workerSlot: $this->workerSlot, generation: $this->generation))
                ->onQueue(config('storage-migration.queue'))
                ->delay(now()->addSeconds((int) config('storage-migration.scan_wait_delay', 5)));

            return;
        }

        if ($this->workerSlot === 0 && $this->storageMigration->status !== StorageMigrationStatus::VERIFYING) {
            $this->startVerifyPass($this->nextVerifyPass);
        }
    }

    private function startVerifyPass(int $pass): void
    {
        if ($pass > (int) config('storage-migration.max_verify_passes')) {
            $this->settle();

            return;
        }

        StorageMigration::whereKey($this->storageMigration->id)
            ->whereIn('status', [StorageMigrationStatus::RUNNING, StorageMigrationStatus::VERIFYING])
            ->where('transfer_paused', false)
            ->update([
            'status' => StorageMigrationStatus::VERIFYING->value,
        ]);
        app(BroadcastStorageMigrationUpdate::class)->broadcast($this->storageMigration);

        dispatch(new self($this->storageMigration, verifyPass: $pass, generation: $this->generation, verifyListing: true))->onQueue(config('storage-migration.queue'));
    }

    /**
     * Verification lists the target once (1,000 objects per request) and compares it with the copied items, instead of
     * requesting every object. Providers such as Backblaze B2 cap and bill those per-object requests.
     */
    private function runVerifyCycle(): void
    {
        if ($this->verifyListing) {
            $this->listTargetForVerify();

            return;
        }

        $chunkSize = (int) config('storage-migration.batch_size') * 40;
        $finalPass = $this->verifyPass >= (int) config('storage-migration.max_verify_passes');

        $items = $this->storageMigration->items()
            ->where('status', StorageMigrationItemStatus::COPIED)
            ->when($this->verifyCursor !== null, fn ($query) => $query->where('id', '>', $this->verifyCursor))
            ->orderBy('id')
            ->limit($chunkSize)
            ->get();

        $sizes = $this->storageMigration->targets()
            ->whereIn('key_hash', $items->map(fn (StorageMigrationItem $item): string => sha1($item->target_key))->all())
            ->pluck('size', 'key_hash');
        $repaired = $this->verifyRepairedSoFar;

        foreach ($items as $item) {
            $size = $sizes[sha1($item->target_key)] ?? null;

            if ($size !== null && ($item->size === null || (int) $size === $item->size)) {
                continue;
            }

            $this->storageMigration->items()
                ->whereKey($item->id)
                ->where('status', StorageMigrationItemStatus::COPIED)
                ->update([
                    'status' => $finalPass ? StorageMigrationItemStatus::FAILED : StorageMigrationItemStatus::PENDING,
                    'copied_bytes' => null,
                    'error' => $size === null
                        ? __('Verification failed: the object was not found on the target after copying.')
                        : __('Verification failed: the object on the target has a different size.'),
                ]);
            StorageMigration::whereKey($this->storageMigration->id)->incrementEach([
                'items_copied' => -1,
                'bytes_copied' => -($item->copied_bytes ?? 0),
                'items_failed' => $finalPass ? 1 : 0,
            ]);
            $repaired++;
        }

        $this->recordActivity();

        if ($items->count() === $chunkSize) {
            dispatch(new self($this->storageMigration, verifyPass: $this->verifyPass, verifyCursor: $items->last()->id, verifyRepairedSoFar: $repaired, generation: $this->generation))
                ->onQueue(config('storage-migration.queue'));

            return;
        }

        if ($repaired > 0) {
            StorageMigration::whereKey($this->storageMigration->id)
                ->where('status', StorageMigrationStatus::VERIFYING)
                ->where('transfer_paused', false)
                ->update([
                    'status' => StorageMigrationStatus::RUNNING->value,
                ]);
            app(BroadcastStorageMigrationUpdate::class)->broadcast($this->storageMigration);

            dispatch(new self($this->storageMigration, nextVerifyPass: $this->verifyPass + 1, generation: $this->generation))->onQueue(config('storage-migration.queue'));

            return;
        }

        $this->settle();
    }

    private function listTargetForVerify(): void
    {
        if ($this->verifyToken === null) {
            StorageMigration::whereKey($this->storageMigration->id)->update(['target_scan_completed_at' => null]);
            $this->storageMigration->targets()->delete();
        }

        $prefix = trim((string) ($this->storageMigration->target->credentials['path'] ?? ''), '/');
        $pageSize = (int) config('storage-migration.list_page_size', 1000);
        $token = $this->verifyToken;

        for ($pages = 0; $pages < 50; $pages++) {
            if (! $this->storageMigration->fresh()->status->isActive() || $this->storageMigration->fresh()->transfer_paused) {
                return;
            }

            $page = $this->copier->listPage($this->targetClient, $this->targetBucket, $prefix !== '' ? $prefix.'/' : '', $token, $pageSize);
            $this->storageMigration->targets()->insertOrIgnore(array_map(
                fn (array $object): array => ['key_hash' => sha1($object['key']), 'size' => $object['size']],
                $page['objects'],
            ));
            $this->recordActivity();
            $token = $page['nextToken'];

            if ($token === null) {
                StorageMigration::whereKey($this->storageMigration->id)->update(['target_scan_completed_at' => now()]);

                break;
            }
        }

        dispatch(new self($this->storageMigration, verifyPass: $this->verifyPass, generation: $this->generation, verifyToken: $token, verifyListing: $token !== null))
            ->onQueue(config('storage-migration.queue'));
    }

    private function settle(): void
    {
        $counts = $this->syncCounters();

        StorageMigration::whereKey($this->storageMigration->id)
            ->whereIn('status', [StorageMigrationStatus::RUNNING, StorageMigrationStatus::VERIFYING])
            ->where('transfer_paused', false)
            ->whereNotNull('scan_completed_at')
            ->update([
            'status' => $counts['items_failed'] > 0 ? StorageMigrationStatus::PARTIAL->value : StorageMigrationStatus::COMPLETED->value,
            'finished_at' => now(),
        ]);

        app(BroadcastStorageMigrationUpdate::class)->broadcast($this->storageMigration);
    }

    private function initClients(): void
    {
        $this->copier = new S3ObjectCopier(
            multipartThreshold: (int) config('storage-migration.multipart_threshold'),
            partSize: (int) config('storage-migration.part_size'),
        );
        $this->sourceClient = $this->clientFor($this->storageMigration->source);
        $this->sourceBucket = $this->storageMigration->source->credentials['bucket'];
        $this->targetClient = $this->clientFor($this->storageMigration->target);
        $this->targetBucket = $this->storageMigration->target->credentials['bucket'];
    }

    private function clientFor(StorageProvider $storage): S3Client
    {
        $provider = new S3($storage);
        $provider->buildClientConfig();

        return $provider->getClient();
    }

    private function claimBatch(): Collection
    {
        return Cache::lock("storage-migration-claim-{$this->storageMigration->id}", 30)->block(5, function (): Collection {
            return DB::connection($this->storageMigration->itemsConnection())->transaction(function (): Collection {
                $this->storageMigration->items()
                    ->where('status', StorageMigrationItemStatus::PROCESSING)
                    ->where(function ($query): void {
                        $query->where('worker_slot', $this->workerSlot)
                            ->orWhereNull('worker_slot')
                            ->orWhere('updated_at', '<', now()->subSeconds($this->lockSeconds()));
                    })
                    ->update(['status' => StorageMigrationItemStatus::PENDING, 'worker_slot' => null]);

                $items = $this->storageMigration->items()
                    ->where('status', StorageMigrationItemStatus::PENDING)
                    ->orderBy('id')
                    ->limit((int) config('storage-migration.batch_size'))
                    ->get();

                if ($items->isNotEmpty()) {
                    $this->storageMigration->items()->whereIn('id', $items->pluck('id'))->update([
                        'status' => StorageMigrationItemStatus::PROCESSING,
                        'worker_slot' => $this->workerSlot,
                    ]);
                }

                return $items;
            });
        });
    }

    /**
     * @param  Collection<string, int>|null  $known  target sizes by key hash from the target inventory, or null to ask the target
     */
    private function processItem(StorageMigrationItem $item, ?Collection $known = null): void
    {
        $this->recordActivity();

        try {
            $item->size ??= $this->copier->head($this->sourceClient, $this->sourceBucket, $item->source_key)['size'] ?? null;
            $existing = $known === null
                ? $this->copier->head($this->targetClient, $this->targetBucket, $item->target_key)
                : ($known->has(sha1($item->target_key)) ? ['size' => (int) $known[sha1($item->target_key)], 'etag' => null] : null);

            if ($existing !== null && $existing['size'] === $item->size) {
                $this->settleItem($item, StorageMigrationItemStatus::SKIPPED, $existing['size'], $existing['etag']);

                return;
            }

            if ($existing !== null && ! $this->storageMigration->overwrite) {
                $this->failItem($item, __('An object already exists at the target path and overwrite is disabled.'), permanent: true);

                return;
            }

            $result = $this->copier->copy(
                $this->sourceClient,
                $this->sourceBucket,
                $item->source_key,
                $this->targetClient,
                $this->targetBucket,
                $item->target_key,
                fn () => $this->recordActivity(),
                $item->size,
            );

            $this->settleItem($item, StorageMigrationItemStatus::COPIED, $result->bytes, $result->checksum);
        } catch (StorageMigrationObjectMissing $e) {
            $this->failItem($item, $e->getMessage(), permanent: true);
        } catch (Throwable $e) {
            $this->failItem($item, Str::limit($e->getMessage(), 1000), permanent: false);
        }
    }

    private function recordActivity(): void
    {
        if ($this->activityRecordedAt !== null && time() - $this->activityRecordedAt < 30) {
            return;
        }

        $this->activityRecordedAt = time();
        StorageMigration::whereKey($this->storageMigration->id)->update(['last_activity_at' => now()]);
    }

    private function settleItem(StorageMigrationItem $item, StorageMigrationItemStatus $status, ?int $bytes, ?string $checksum): void
    {
        Cache::lock("storage-migration-counters-{$this->storageMigration->id}", 30)->block(5, function () use ($item, $status, $bytes, $checksum): void {
            $updated = $this->storageMigration->items()
                ->whereKey($item->id)
                ->where('status', StorageMigrationItemStatus::PROCESSING)
                ->where('worker_slot', $this->workerSlot)
                ->update([
                    'status' => $status,
                    'copied_bytes' => $bytes,
                    'checksum' => $checksum,
                    'error' => null,
                    ...($status === StorageMigrationItemStatus::COPIED ? ['size' => $bytes] : []),
                ]);

            if ($updated) {
                StorageMigration::whereKey($this->storageMigration->id)->incrementEach([
                    $status === StorageMigrationItemStatus::COPIED ? 'items_copied' : 'items_skipped' => 1,
                    'bytes_copied' => $bytes ?? 0,
                ]);
            }
        });
    }

    private function failItem(StorageMigrationItem $item, string $message, bool $permanent): void
    {
        $attempts = $item->attempts + 1;
        $exhausted = $attempts >= (int) config('storage-migration.max_attempts');

        Cache::lock("storage-migration-counters-{$this->storageMigration->id}", 30)->block(5, function () use ($item, $message, $permanent, $exhausted, $attempts): void {
            $updated = $this->storageMigration->items()
                ->whereKey($item->id)
                ->where('status', StorageMigrationItemStatus::PROCESSING)
                ->where('worker_slot', $this->workerSlot)
                ->update([
                    'status' => ($permanent || $exhausted) ? StorageMigrationItemStatus::FAILED : StorageMigrationItemStatus::PENDING,
                    'attempts' => $attempts,
                    'error' => $message,
                ]);

            if ($updated && ($permanent || $exhausted)) {
                StorageMigration::whereKey($this->storageMigration->id)->increment('items_failed');
            }
        });
    }

    /**
     * @return array{items_total: int, items_copied: int, items_skipped: int, items_failed: int, bytes_total: int, bytes_copied: int}
     */
    private function syncCounters(): array
    {
        return Cache::lock("storage-migration-counters-{$this->storageMigration->id}", 30)->block(5, function (): array {
            $counts = $this->storageMigration->items()
                ->toBase()
                ->selectRaw('status, count(*) as aggregate, sum(coalesce(copied_bytes, 0)) as bytes, sum(coalesce(size, 0)) as size')
                ->groupBy('status')
                ->get()
                ->keyBy('status');

            $result = [
                'items_total' => (int) $counts->sum('aggregate'),
                'items_copied' => (int) ($counts[StorageMigrationItemStatus::COPIED->value]->aggregate ?? 0),
                'items_skipped' => (int) ($counts[StorageMigrationItemStatus::SKIPPED->value]->aggregate ?? 0),
                'items_failed' => (int) ($counts[StorageMigrationItemStatus::FAILED->value]->aggregate ?? 0),
                'bytes_total' => (int) $counts->sum('size'),
                'bytes_copied' => (int) $counts->sum('bytes'),
            ];
    
            StorageMigration::whereKey($this->storageMigration->id)->update($result);
    
            return $result;
        });
    }
}
