<?php

namespace App\Actions\Backup;

use App\Actions\Database\SyncDatabases;
use App\Actions\Database\SyncDatabaseUsers;
use App\Actions\Server\CreateServer;
use App\Enums\BackupFileStatus;
use App\Enums\BackupRestoreStatus;
use App\Enums\BackupType;
use App\Enums\ServerRole;
use App\Enums\ServerStatus;
use App\Facades\Notifier;
use App\Jobs\Backup\RestoreToNewServerJob;
use App\Models\Backup;
use App\Models\BackupRestore;
use App\Models\ServerProvider;
use App\Models\User;
use App\Notifications\BackupRestoreFinished;
use App\SSH\PostgresReplication;
use App\SSH\TransientUnit;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * Creates a server at a cloud provider and restores a pgBackRest backup onto it as an independent PostgreSQL server.
 * The copy never archives WAL, so it cannot write into the source's backup repository.
 */
class RestoreToNewServer
{
    /**
     * What the new server needs. Storage covers the largest database the backups hold plus 20% growth, WAL replay and the
     * operating system; before a backup reports its database size, the disk the source server uses stands in for it.
     * vCPU, memory and architecture come from the source server's plan, else from its latest metrics.
     *
     * @return array{database_size: ?int, storage_gb: ?int, measured: bool, cores: ?int, memory_gb: ?float, architecture: ?string, os: string, postgresql: ?string, source: string}
     */
    public function requirements(Backup $backup): array
    {
        $source = $backup->server;
        $metric = $source->latestMetric()->first();
        $databaseSize = $backup->files()->where('status', BackupFileStatus::CREATED)->max('database_size');
        $basis = $databaseSize ?? ($metric !== null ? $metric->disk_used * 1048576 : null);
        $plan = rescue(fn (): ?array => $source->serverProvider?->provider()->plans($source->provider_data['region'] ?? null)[$source->provider_data['plan'] ?? ''] ?? null, null, false);

        return [
            'database_size' => $databaseSize === null ? null : (int) $databaseSize,
            'storage_gb' => $basis === null ? null : (int) ceil($basis / 1073741824 * 1.2 + ($databaseSize !== null ? 12 : 5)),
            'measured' => $databaseSize !== null,
            'cores' => $plan['cores'] ?? $metric?->cpu_cores,
            'memory_gb' => $plan['memory'] ?? ($metric !== null ? round($metric->memory_total / 1048576, 1) : null),
            'architecture' => $plan['architecture'] ?? null,
            'os' => $source->os->value,
            'postgresql' => $source->database()?->version ?? $backup->files()->latest('id')->value('database_version'),
            'source' => $source->name,
        ];
    }

    public function create(User $user, Backup $backup, array $input): BackupRestore
    {
        $oldest = $backup->files()->where('status', BackupFileStatus::CREATED)->oldest('id')->value('created_at');

        if ($backup->type !== BackupType::PGBACKREST || $backup->status !== null || $oldest === null) {
            throw ValidationException::withMessages([
                'backup' => __('Only a ready pgBackRest backup with at least one finished backup can be restored to a new server.'),
            ]);
        }

        $validated = Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'server_provider' => ['required', 'integer'],
            'region' => ['required', 'string'],
            'plan' => ['required', 'string'],
            'target' => ['required', Rule::in(['latest', 'backup', 'time'])],
            'backup_file_id' => ['nullable', 'required_if:target,backup', Rule::exists('backup_files', 'id')->where('backup_id', $backup->id)->where('status', BackupFileStatus::CREATED->value)],
            'target_time' => ['nullable', 'required_if:target,time', 'date', 'before:now', 'after:'.$oldest->toDateTimeString()],
        ], [
            'target_time.after' => __('The oldest backup started at :time, so the restore point must be later.', ['time' => $oldest->toDateTimeString()]),
        ])->validate();

        $requirements = $this->requirements($backup);
        $provider = ServerProvider::query()->find($validated['server_provider']);
        $plan = rescue(fn (): ?array => $provider?->provider()->plans($validated['region'])[$validated['plan']] ?? null, null, false);

        if (isset($plan['disk'], $requirements['storage_gb']) && $plan['disk'] < $requirements['storage_gb']) {
            throw ValidationException::withMessages([
                'plan' => __('This plan has :disk GB of disk, but the restore needs at least :required GB.', ['disk' => $plan['disk'], 'required' => $requirements['storage_gb']]),
            ]);
        }

        if (isset($plan['architecture'], $requirements['architecture']) && $plan['architecture'] !== $requirements['architecture']) {
            throw ValidationException::withMessages([
                'plan' => __(':source runs on :architecture. PostgreSQL data files are not safe to restore on another processor architecture, so choose a :architecture plan.', [
                    'source' => $requirements['source'],
                    'architecture' => $requirements['architecture'],
                ]),
            ]);
        }

        $server = app(CreateServer::class)->create($user, $backup->server->project, [
            'provider' => $provider?->provider,
            'server_provider' => $validated['server_provider'],
            'region' => $validated['region'],
            'plan' => $validated['plan'],
            'name' => $validated['name'],
            'os' => $requirements['os'],
            'role' => ServerRole::DATABASE->value,
            'services' => [
                ['type' => 'database', 'name' => 'postgresql', 'version' => (string) $requirements['postgresql']],
                ['type' => 'monitoring', 'name' => 'remote-monitor', 'version' => 'latest'],
            ],
        ]);

        $restore = $backup->restores()->create([
            'backup_file_id' => $validated['target'] === 'backup' ? $validated['backup_file_id'] : null,
            'server_id' => $server->id,
            'target' => $validated['target'],
            'target_time' => $validated['target'] === 'time' ? $validated['target_time'] : null,
            'status' => BackupRestoreStatus::WAITING_FOR_SERVER,
            'step' => __('Creating and installing the server'),
        ]);

        dispatch(new RestoreToNewServerJob($restore))->onQueue('ssh')->delay(now()->addMinute());

        return $restore;
    }

    /**
     * Starts the restore once the new server is installed; does nothing while it is still being installed.
     */
    public function start(BackupRestore $restore): void
    {
        $server = $restore->server ?? throw new RuntimeException(__('The new server was deleted.'));

        if ($server->status === ServerStatus::INSTALLATION_FAILED) {
            throw new RuntimeException(__('Installing the new server failed. Check its logs, then delete it and restore again.'));
        }

        if ($server->status !== ServerStatus::READY) {
            if ($restore->created_at->lt(now()->subHours(2))) {
                throw new RuntimeException(__('The new server was not ready within two hours.'));
            }

            return;
        }

        $backup = $restore->backup;
        $postgres = PostgresReplication::inspect($server);
        $version = intdiv($postgres['version_num'], 10000);
        $expected = (int) ($restore->file?->database_version ?? $backup->files()->where('status', BackupFileStatus::CREATED)->latest('id')->value('database_version'));

        if ($restore->target === 'backup' && $restore->file?->status !== BackupFileStatus::CREATED) {
            throw new RuntimeException(__('The chosen backup expired before the server was ready. Restore the latest backup or a point in time instead.'));
        }

        if ($expected !== 0 && $expected !== $version) {
            throw new RuntimeException(__('The new server runs PostgreSQL :version, but the backup is from PostgreSQL :expected.', ['version' => $version, 'expected' => $expected]));
        }

        $restore->update(['status' => BackupRestoreStatus::RESTORING, 'step' => __('Installing pgBackRest')]);
        $server->ssh()->exec(view('ssh.pgbackrest.install-package'), 'pgbackrest-install');
        $backup->pgBackRest()->writeConfig($server, $postgres['data_directory'], $postgres['port']);

        [$options, $label] = match ($restore->target) {
            'backup' => ['--set='.escapeshellarg($restore->file->name).' --type=immediate --target-action=promote', __('backup :name', ['name' => $restore->file->name])],
            'time' => ['--type=time --target='.escapeshellarg($restore->target_time->utc()->format('Y-m-d H:i:sP')).' --target-action=promote', __('the state at :time UTC', ['time' => $restore->target_time->utc()->toDateTimeString()])],
            default => ['', __('the latest backup and all archived WAL')],
        };

        $this->unit($restore)->start(view('ssh.pgbackrest.restore', [
            'dataDirectory' => $postgres['data_directory'],
            'confDirectory' => PostgresReplication::confDirectory($server),
            'version' => $version,
            'stanza' => $backup->pgBackRest()->stanza(),
            'options' => $options,
            'label' => $label,
        ])->render(), 'Vito pgBackRest restore');

        $restore->update(['step' => __('Restoring :label', ['label' => $label])]);
    }

    /**
     * Returns true once the restore finished or failed.
     */
    public function monitor(BackupRestore $restore): bool
    {
        $unit = $this->unit($restore);
        $state = $unit->state();

        if ($state === 'running') {
            $line = trim(Str::afterLast($unit->output(1, 'cat'), "\n"));
            $restore->update(['step' => $line !== '' ? Str::limit($line, 250) : $restore->step]);

            return false;
        }

        if ($state !== 'succeeded') {
            $reason = $state === 'missing'
                ? __('The restore on the new server stopped before it finished, for example because the server restarted.')
                : $unit->failureReason();
            $unit->cleanup();
            $this->fail($restore, $reason !== '' ? $reason : __('The restore failed.'));

            return true;
        }

        $unit->cleanup();
        app(SyncDatabases::class)->sync($restore->server);
        app(SyncDatabaseUsers::class)->sync($restore->server);

        $restore->update(['status' => BackupRestoreStatus::COMPLETED, 'step' => null, 'finished_at' => now()]);
        Notifier::send($restore->server, new BackupRestoreFinished($restore));

        return true;
    }

    public function fail(BackupRestore $restore, string $message): void
    {
        $restore->update(['status' => BackupRestoreStatus::FAILED, 'message' => Str::limit($message, 2000), 'finished_at' => now()]);

        if ($restore->server?->status === ServerStatus::READY) {
            rescue(fn () => $restore->server->ssh()->exec('sudo rm -f /etc/pgbackrest/pgbackrest.conf', 'pgbackrest-restore-cleanup'), report: false);
        }

        Notifier::send($restore->server ?? $restore->backup->server, new BackupRestoreFinished($restore));
    }

    private function unit(BackupRestore $restore): TransientUnit
    {
        return new TransientUnit($restore->server ?? throw new RuntimeException(__('The new server was deleted.')), 'vito-pgbackrest-restore-'.$restore->id);
    }
}
