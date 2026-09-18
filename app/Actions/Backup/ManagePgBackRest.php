<?php

namespace App\Actions\Backup;

use App\Actions\DatabaseReplica\ManageDatabaseReplica;
use App\DTOs\SocketEventDTO;
use App\Enums\BackupFileStatus;
use App\Enums\BackupStatus;
use App\Enums\BackupType;
use App\Enums\PgBackRestStrategy;
use App\Enums\PostgresClusterStatus;
use App\Events\SocketEvent;
use App\Exceptions\SSHError;
use App\Http\Resources\BackupFileResource;
use App\Jobs\Backup\CheckPgBackRestJob;
use App\Jobs\Backup\MonitorPgBackRestJob;
use App\Jobs\Backup\SetupPgBackRestJob;
use App\Jobs\Backup\VerifyPgBackRestJob;
use App\Models\Backup;
use App\Models\BackupFile;
use App\Models\PostgresCluster;
use App\Models\Server;
use App\Models\StorageProvider;
use App\StorageProviders\S3;
use App\ValidationRules\CronRule;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class ManagePgBackRest
{
    /**
     * @var array<string, int>
     */
    private const TYPE_RANK = ['incr' => 1, 'diff' => 2, 'full' => 3];

    /**
     * Backup types that satisfy each schedule, from the most complete.
     *
     * @var array<string, list<string>>
     */
    private const COVERED_BY = ['full' => ['full'], 'diff' => ['full', 'diff'], 'incr' => ['full', 'diff', 'incr']];

    public function create(Server $server, array $input): Backup
    {
        $this->validate($input, true);

        if ($server->database()?->name !== 'postgresql') {
            throw ValidationException::withMessages([
                'type' => __('pgBackRest backups need a PostgreSQL service on this server.'),
            ]);
        }

        $cluster = PostgresCluster::forServer($server);

        if ($cluster !== null && $cluster->primary_server_id !== $server->id) {
            throw ValidationException::withMessages([
                'type' => __('This server is a replica. Its cluster is backed up from the primary.'),
            ]);
        }

        if ($server->backups()->where('type', BackupType::PGBACKREST)->exists()) {
            throw ValidationException::withMessages([
                'type' => __('This server already has a pgBackRest backup.'),
            ]);
        }

        $settings = $this->settings($input);

        $backup = new Backup([
            'type' => BackupType::PGBACKREST,
            'server_id' => $server->id,
            'storage_id' => $input['storage'],
            'interval' => $settings['schedules']['full'],
            'keep_backups' => $settings['retention']['full'],
            'status' => BackupStatus::INSTALLING,
            'configuration' => [
                'cipher_pass' => Str::password(64, symbols: false),
                'dropped_wal' => 0,
                ...$settings,
            ],
        ]);
        $backup->enabled = true;
        $backup->save();

        if ($cluster === null) {
            PostgresCluster::query()->create([
                'project_id' => $server->project_id,
                'primary_server_id' => $server->id,
                'backup_id' => $backup->id,
                'stanza' => (Str::slug($server->name) ?: 'server').'-'.$server->id,
                'status' => PostgresClusterStatus::ACTIVE,
            ]);
        } else {
            $cluster->update(['backup_id' => $backup->id]);
        }

        dispatch(new SetupPgBackRestJob($backup))->onQueue('ssh');

        return $backup;
    }

    public function update(Backup $backup, array $input): void
    {
        $this->validate($input, false);

        $settings = $this->settings($input);

        $backup->interval = $settings['schedules']['full'];
        $backup->keep_backups = $settings['retention']['full'];
        $backup->configuration = [...$backup->configuration, ...$settings];

        if ($backup->status === BackupStatus::FAILED) {
            $backup->save();
            $this->reinstall($backup);

            return;
        }

        $backup->save();

        if ($backup->status === null) {
            $backup->pgBackRest()->writeConfigs();
        }
    }

    public function setup(Backup $backup): void
    {
        $pgBackRest = $backup->pgBackRest();
        $cluster = $pgBackRest->install();
        $backup->refresh();
        $backup->configuration = [...$backup->configuration, ...$cluster];
        $backup->save();

        $pgBackRest->writeConfigs();
        $pgBackRest->enableArchiving();

        $backup->status = null;
        $backup->save();

        app(BroadcastBackupUpdate::class)->broadcast($backup);

        if ($backup->files()->doesntExist()) {
            app(RunBackup::class)->run($backup, 'full');
        }
    }

    public function storageChanged(StorageProvider $storage): void
    {
        Backup::query()
            ->where('type', BackupType::PGBACKREST)
            ->where('storage_id', $storage->id)
            ->where(fn ($query) => $query->whereNull('status')->orWhere('status', BackupStatus::FAILED))
            ->each(fn (Backup $backup) => $this->reinstall($backup));
    }

    public function reinstall(Backup $backup): void
    {
        $backup->status = BackupStatus::INSTALLING;
        $backup->save();

        app(BroadcastBackupUpdate::class)->broadcast($backup);
        dispatch(new SetupPgBackRestJob($backup))->onQueue('ssh');
    }

    public function schedule(Backup $backup): bool
    {
        if ($backup->cluster?->status !== PostgresClusterStatus::ACTIVE) {
            return false;
        }

        return $this->locked($backup, fn (): bool => $this->startDue($backup->refresh()));
    }

    private function startDue(Backup $backup): bool
    {
        $configuration = $backup->configuration;
        $now = now();
        $tasks = collect(['verify' => VerifyPgBackRestJob::class, 'check' => CheckPgBackRestJob::class])
            ->filter(fn (string $job, string $task): bool => $this->missed($configuration[$task.'_schedule'] ?? null, $configuration[$task.'_requested_at'] ?? $backup->created_at, $now));
        $due = collect(self::COVERED_BY)
            ->filter(fn (array $types, string $type): bool => $this->missed(
                $configuration['schedules'][$type] ?? null,
                $backup->files()->whereIn('type', $types)->latest('id')->value('created_at') ?? $backup->created_at,
                $now,
            ))
            ->keys()
            ->first();
        $type = $this->higher($due, $configuration['queued_type'] ?? null);
        $running = $backup->files()->where('status', BackupFileStatus::CREATING)->exists();

        if ($tasks->isEmpty() && ($type === null || ($running && $type === ($configuration['queued_type'] ?? null)))) {
            return false;
        }

        $backup->configuration = [
            ...$configuration,
            ...$tasks->keys()->mapWithKeys(fn (string $task): array => [$task.'_requested_at' => $now->toIso8601String()])->all(),
            'queued_type' => $running ? $type : null,
        ];
        $backup->save();

        $tasks->each(fn (string $job) => dispatch(new $job($backup))->onQueue('ssh'));

        if ($type === null || $running) {
            return false;
        }

        app(RunBackup::class)->run($backup, $type);

        return true;
    }

    public function run(BackupFile $file): void
    {
        $backup = $file->backup;
        $cluster = $backup->cluster;

        if ($cluster->status !== PostgresClusterStatus::ACTIVE) {
            throw new RuntimeException(__('The PostgreSQL cluster started failing over before this backup could start.'));
        }
        $host = app(SelectPgBackRestHost::class)->select($cluster);

        $file->server_id = $host->id;
        $file->type ??= 'incr';
        $file->database_engine = 'postgresql';
        $file->database_version = BackupFile::normalizeVersion($backup->server->database()?->version);
        $file->save();
        $file->setRelation('server', $host);

        $pgBackRest = $backup->pgBackRest();
        $pgBackRest->writeConfig($host);
        $pgBackRest->startBackup($file, $host, $file->type, $host->id !== $cluster->primary_server_id);

        dispatch(new MonitorPgBackRestJob($file))->onQueue('ssh')->delay(now()->addMinute());
    }

    public function monitor(BackupFile $file): bool
    {
        $backup = $file->backup;
        $pgBackRest = $backup->pgBackRest();
        $host = $file->server ?? $backup->server;
        $state = $pgBackRest->unitState($file);

        if ($state === 'running') {
            $lock = rescue(fn (): array => $pgBackRest->info($host)['status']['lock']['backup'] ?? [], [], false);

            if (($lock['size'] ?? 0) > 0) {
                $file->progress = round(($lock['size-cplt'] ?? 0) / $lock['size'] * 100, 2);
            }

            $file->touch();
            $this->broadcast($file);

            return false;
        }

        if ($state === 'failed') {
            $reason = $pgBackRest->failureReason($file);
            $pgBackRest->cleanup($file);
            $this->fail($file, $reason !== '' ? $reason : __('The pgBackRest backup failed.'));

            return true;
        }

        $backups = $pgBackRest->info($host)['backup'] ?? [];
        $archive = $pgBackRest->archiveStatus();
        $pgBackRest->cleanup($file);

        $known = $backup->files()->whereKeyNot($file->id)->pluck('name')->all();
        $created = collect($backups)
            ->filter(fn (array $item): bool => ($item['timestamp']['start'] ?? 0) >= $file->created_at->getTimestamp() - 300
                && ! in_array($item['label'], $known, true))
            ->sortByDesc(fn (array $item): int => (int) $item['timestamp']['start'])
            ->first();

        if ($created === null) {
            $this->fail($file, $state === 'missing'
                ? __('The backup process on the server stopped before it finished, for example because the server restarted.')
                : __('pgBackRest finished without adding a backup to the repository.'));

            return true;
        }

        $file->name = $created['label'];
        $file->type = $created['type'] ?? $file->type;
        $file->size = $created['info']['repository']['delta'] ?? null;
        $file->status = BackupFileStatus::CREATED;
        $file->progress = null;
        $file->message = implode(' ', array_filter([
            ($created['error'] ?? false) ? __('pgBackRest reported errors in this backup, such as page checksum failures. Run pgbackrest verify on the server.') : null,
            ...$this->checkArchiving($backup, $archive),
        ])) ?: null;
        $file->save();

        $backup->configuration = [...$backup->configuration, 'last_backup_errors' => (bool) ($created['error'] ?? false)];
        $backup->save();

        $sizes = collect($backups)->mapWithKeys(fn (array $item): array => [$item['label'] => $item['info']['size'] ?? null]);
        $backup->files()->whereNull('database_size')->whereIn('name', $sizes->keys())->get()
            ->each(fn (BackupFile $known) => $known->update(['database_size' => $sizes[$known->name]]));

        $this->prune($backup, $backups);
        $this->broadcast($file);
        $this->startQueued($backup);
        app(ManageDatabaseReplica::class)->backupAvailable($backup->cluster);
        app(CheckBackupHealth::class)->check($backup);

        return true;
    }

    public function startVerify(Backup $backup): void
    {
        if ($backup->cluster->status !== PostgresClusterStatus::ACTIVE) {
            return;
        }

        $host = app(SelectPgBackRestHost::class)->select($backup->cluster);
        $pgBackRest = $backup->pgBackRest();

        $pgBackRest->writeConfig($host);
        $pgBackRest->startVerify($host);

        $backup->configuration = [...$backup->configuration, 'verify' => ['server_id' => $host->id, 'started_at' => now()->toIso8601String()]];
        $backup->save();
    }

    public function monitorVerify(Backup $backup): bool
    {
        $host = Server::query()->find($backup->configuration['verify']['server_id'] ?? null) ?? $backup->server;
        $unit = $backup->pgBackRest()->verifyUnit($host);
        $state = $unit->state();

        if ($state === 'running') {
            return false;
        }

        $reason = $state === 'succeeded' ? '' : $unit->failureReason();
        $unit->cleanup();

        $configuration = $backup->refresh()->configuration;
        unset($configuration['verify']);
        $backup->configuration = [
            ...$configuration,
            'last_verified_at' => now()->toIso8601String(),
            'last_verify_result' => $state === 'succeeded' ? 'passed' : 'failed',
            'last_verify_error' => $state === 'succeeded' ? null : ($reason !== '' ? $reason : __('The verify process stopped before it finished.')),
        ];
        $backup->save();

        app(BroadcastBackupUpdate::class)->broadcast($backup);
        app(CheckBackupHealth::class)->check($backup);

        return true;
    }

    public function runCheck(Backup $backup): void
    {
        $problem = null;

        try {
            $backup->pgBackRest()->check();
        } catch (SSHError $e) {
            $problem = __('pgbackrest check failed on the primary, so WAL may not be reaching S3: :error', ['error' => $e->getMessage()]);
        }

        $backup->refresh();
        $backup->configuration = [
            ...$backup->configuration,
            'last_checked_at' => now()->toIso8601String(),
            'last_check_result' => $problem === null ? 'passed' : 'failed',
            'last_check_error' => $problem,
        ];
        $backup->save();

        app(CheckBackupHealth::class)->check($backup);
    }

    public function checkArchiving(Backup $backup, ?array $archive = null): array
    {
        $archive ??= $backup->pgBackRest()->archiveStatus();
        $backup->refresh();
        $droppedBefore = (int) ($backup->configuration['dropped_wal'] ?? 0);
        $problems = [];

        if ($archive['failing']) {
            $problems[] = __('PostgreSQL is failing to archive WAL to S3, so point-in-time recovery is falling behind.');
        }

        if ($archive['dropped'] > $droppedBefore) {
            $problems[] = __('pgBackRest dropped WAL because the archive queue exceeded :size GiB, so point-in-time recovery has a gap until the next backup.', [
                'size' => $backup->configuration['wal_queue_max_gb'],
            ]);
        }

        $backup->configuration = [
            ...$backup->configuration,
            'dropped_wal' => $archive['dropped'],
            'archive_failing' => $archive['failing'],
            'wal_dropped_at' => $archive['dropped'] > $droppedBefore ? now()->toIso8601String() : ($backup->configuration['wal_dropped_at'] ?? null),
        ];
        $backup->save();

        return $problems;
    }

    public function fail(BackupFile $file, string $message): void
    {
        $file->status = BackupFileStatus::FAILED;
        $file->progress = null;
        $file->message = Str::limit($message, 1000);
        $file->save();

        $this->broadcast($file);
        app(CheckBackupHealth::class)->check($file->backup);
        $this->startQueued($file->backup);
    }

    public function queue(Backup $backup, string $type): void
    {
        $backup->configuration = [...$backup->configuration, 'queued_type' => $this->higher($type, $backup->configuration['queued_type'] ?? null)];
        $backup->save();

        $this->startQueued($backup);
    }

    private function startQueued(Backup $backup): void
    {
        $this->locked($backup, function () use ($backup): bool {
            $backup->refresh();
            $type = $backup->configuration['queued_type'] ?? null;

            if ($type === null || $backup->status !== null || ! $backup->enabled || $backup->files()->where('status', BackupFileStatus::CREATING)->exists()) {
                return false;
            }

            $backup->configuration = [...$backup->configuration, 'queued_type' => null];
            $backup->save();

            app(RunBackup::class)->run($backup, $type);

            return true;
        });
    }

    /**
     * Serializes the decision to start a run with the run's creation, so the scheduler and a finishing backup never both start one.
     *
     * @param  callable(): bool  $callback
     */
    private function locked(Backup $backup, callable $callback): bool
    {
        return Cache::lock('pgbackrest-schedule-'.$backup->id, 120)->block(30, $callback);
    }

    /**
     * Whether the schedule came due after the last attempt, so a run missed while Vito was down starts once it is back.
     */
    private function missed(?string $expression, Carbon|string $last, Carbon $now): bool
    {
        return Backup::lastDue($expression, $now)?->gt(Carbon::parse($last)) ?? false;
    }

    private function higher(?string $first, ?string $second): ?string
    {
        if ($first === null || $second === null) {
            return $first ?? $second;
        }

        return self::TYPE_RANK[$first] >= self::TYPE_RANK[$second] ? $first : $second;
    }

    private function prune(Backup $backup, array $backups): void
    {
        $oldest = Carbon::createFromTimestamp(min(array_map(fn (array $item): int => (int) $item['timestamp']['start'], $backups)));

        $backup->files()
            ->where(fn ($query) => $query
                ->where(fn ($created) => $created->where('status', BackupFileStatus::CREATED)->whereNotIn('name', array_column($backups, 'label')))
                ->orWhere(fn ($failed) => $failed->where('status', BackupFileStatus::FAILED)->where('created_at', '<', $oldest)))
            ->get()
            ->each(function (BackupFile $expired) use ($backup): void {
                $expired->delete();

                SocketEvent::dispatch(new SocketEventDTO(
                    projectId: $backup->server->project_id,
                    type: 'backup-file.deleted',
                    data: ['id' => $expired->id],
                ));
            });
    }

    private function broadcast(BackupFile $file): void
    {
        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $file->backup->server->project_id,
            type: 'backup-file.updated',
            data: new BackupFileResource($file),
        ));

        app(BroadcastBackupUpdate::class)->broadcast($file->backup);
    }

    private function validate(array $input, bool $creating): void
    {
        $rules = [
            'strategy' => ['required', Rule::enum(PgBackRestStrategy::class)->only(array_map(PgBackRestStrategy::from(...), config('core.pgbackrest_strategies')))],
            'process_max' => ['required', 'integer', 'min:1', 'max:64'],
            'wal_queue_max_gb' => ['required', 'integer', 'min:1', 'max:100000'],
        ];

        if ($creating) {
            $rules['storage'] = ['required', Rule::exists('storage_providers', 'id')->where('provider', S3::id())];
        }

        if (($input['strategy'] ?? null) === PgBackRestStrategy::CUSTOM->value) {
            $rules['full_schedule'] = ['required', new CronRule];
            $rules['diff_schedule'] = ['nullable', new CronRule];
            $rules['incr_schedule'] = ['nullable', new CronRule];
            $rules['retention_full'] = ['required', 'integer', 'min:1', 'max:100'];
            $rules['retention_diff'] = ['nullable', 'integer', 'min:1', 'max:1000'];
        }

        Validator::make($input, $rules, [
            'storage.exists' => __('pgBackRest backups need an S3 storage provider.'),
        ])->validate();
    }

    /**
     * @return array{strategy: string, schedules: array{full: string, diff: ?string, incr: ?string}, retention: array{full: int, diff: ?int}, verify_schedule: string, check_schedule: string, process_max: int, wal_queue_max_gb: int}
     */
    private function settings(array $input): array
    {
        $strategy = PgBackRestStrategy::from($input['strategy']);
        $standard = PgBackRestStrategy::standard();

        return [
            ...$standard,
            'strategy' => $strategy->value,
            ...($strategy === PgBackRestStrategy::CUSTOM ? [
                'schedules' => [
                    'full' => $input['full_schedule'],
                    'diff' => filled($input['diff_schedule'] ?? null) ? $input['diff_schedule'] : null,
                    'incr' => filled($input['incr_schedule'] ?? null) ? $input['incr_schedule'] : null,
                ],
                'retention' => [
                    'full' => (int) $input['retention_full'],
                    'diff' => filled($input['retention_diff'] ?? null) ? (int) $input['retention_diff'] : null,
                ],
            ] : []),
            'process_max' => (int) $input['process_max'],
            'wal_queue_max_gb' => (int) $input['wal_queue_max_gb'],
        ];
    }
}
