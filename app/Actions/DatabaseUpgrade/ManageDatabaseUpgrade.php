<?php

namespace App\Actions\DatabaseUpgrade;

use App\Actions\Database\SyncDatabases;
use App\Actions\Database\SyncDatabaseUsers;
use App\Actions\FirewallRule\ManageRule;
use App\Actions\PostgresCluster\SyncPostgresListenAddresses;
use App\Actions\Server\CreateServer;
use App\Actions\Service\Manage;
use App\Actions\Service\SyncServiceStatus;
use App\Enums\BackupFileStatus;
use App\Enums\BackupType;
use App\Enums\DatabaseUpgradeStatus;
use App\Enums\FirewallRuleStatus;
use App\Enums\ServerRole;
use App\Enums\ServerStatus;
use App\Enums\ServiceStatus;
use App\Exceptions\SSHError;
use App\Facades\Notifier;
use App\Jobs\DatabaseUpgrade\CancelDatabaseUpgradeJob;
use App\Jobs\DatabaseUpgrade\FinishDatabaseUpgradeJob;
use App\Jobs\DatabaseUpgrade\RunDatabaseUpgradeJob;
use App\Models\DatabaseUpgrade;
use App\Models\FirewallRule;
use App\Models\PostgresCluster;
use App\Models\Server;
use App\Models\ServerProvider;
use App\Models\User;
use App\Notifications\DatabaseUpgradeUpdated;
use App\SSH\PostgresLogicalReplication;
use Carbon\Carbon;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class ManageDatabaseUpgrade
{
    public function requirements(Server $source): array
    {
        $inspect = PostgresLogicalReplication::inspect($source);
        $metric = $source->latestMetric()->first();
        $plan = rescue(fn (): ?array => $source->serverProvider?->provider()->plans($source->provider_data['region'] ?? null)[$source->provider_data['plan'] ?? ''] ?? null, null, false);

        $version = intdiv($inspect['version_num'], 10000);
        $count = count($inspect['databases']);
        $size = (int) array_sum(array_column($inspect['databases'], 'size'));
        $slots = max($inspect['max_replication_slots'], $inspect['used_slots'] + $count);
        $senders = max($inspect['max_wal_senders'], $inspect['used_senders'] + $count);

        return [
            ...$this->versions($source),
            'version' => $version,
            'databases' => $inspect['databases'],
            'database_size' => $size,
            'storage_gb' => (int) ceil($size / 1073741824 * 1.3 + 10),
            'cores' => $plan['cores'] ?? $metric?->cpu_cores,
            'memory_gb' => $plan['memory'] ?? ($metric !== null ? round($metric->memory_total / 1048576, 1) : null),
            'os' => $source->os->value,
            'source' => $source->name,
            'restart_needed' => $inspect['wal_level'] !== 'logical'
                || $slots > $inspect['max_replication_slots']
                || $senders > $inspect['max_wal_senders'],
            'read_only' => $inspect['read_only'],
            'wal_level' => $inspect['wal_level'],
            'wal_keep_gb' => $metric === null ? 50 : max(10, min(200, (int) floor($metric->disk_free / 1024 * 0.25))),
            'required_slots' => $slots,
            'required_senders' => $senders,
            'tables_without_key' => $inspect['tables_without_key'],
            'tables_without_key_count' => (int) array_sum(array_column($inspect['databases'], 'without_key')),
            'warnings' => $this->warnings($source, $inspect),
            'seed' => $this->seedable($source),
        ];
    }

    public function versions(Server $source): array
    {
        $version = (int) ($source->database()?->name === 'postgresql' ? $source->database()->version : 0);

        return [
            'version' => $version,
            'versions' => array_values(array_filter(
                config('service.services.postgresql.versions', []),
                fn (string $candidate): bool => is_numeric($candidate) && (int) $candidate > $version,
            )),
            'source' => $source->name,
        ];
    }

    public function seedable(Server $source): array
    {
        $backup = $source->backups()->where('type', BackupType::PGBACKREST)->first();
        $file = $backup?->files()->where('status', BackupFileStatus::CREATED)->latest('id')->first();

        $stanza = $backup === null ? null : rescue(fn (): ?string => $backup->pgBackRest()->stanza(), null, false);

        $reason = match (true) {
            $backup === null => 'This server has no pgBackRest backup. Add one on the Backups page, let a full backup finish, and the new server can start from it.',
            $backup->status !== null => 'The pgBackRest backup of this server is not ready.',
            $file === null => 'No backup has finished yet.',
            $stanza === null => 'Vito cannot tell which pgBackRest stanza this backup writes to.',
            default => null,
        };

        return [
            'available' => $reason === null,
            'reason' => $reason,
            'stanza' => $reason === null ? $stanza : null,
            'taken_at' => $file?->created_at?->toIso8601String(),
        ];
    }

    public function create(User $user, Server $source, array $input): DatabaseUpgrade
    {
        $requirements = $this->requirements($source);

        $validated = Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            'server_provider' => ['required', 'integer'],
            'region' => ['required', 'string'],
            'plan' => ['required', 'string'],
            'version' => ['required', Rule::in($requirements['versions'])],
            'restart' => [$requirements['restart_needed'] ? 'accepted' : 'nullable'],
            'replica_identity' => [$requirements['tables_without_key_count'] > 0 ? 'required' : 'nullable', Rule::in(['full', 'leave'])],
            'wal_keep_gb' => ['required', 'integer', 'min:1', 'max:10000'],
            'mode' => ['required', Rule::in(['logical', 'seeded'])],
        ], [
            'restart.accepted' => 'PostgreSQL on '.$source->name.' needs settings that only apply after a restart, so confirm the restart.',
        ])->validate();

        $provider = ServerProvider::query()->find($validated['server_provider']);
        $plan = rescue(fn (): ?array => $provider?->provider()->plans($validated['region'])[$validated['plan']] ?? null, null, false);

        $error = match (true) {
            $source->database()?->name !== 'postgresql' => 'Only a PostgreSQL server can be upgraded this way.',
            $validated['mode'] === 'seeded' && ! $requirements['seed']['available'] => $requirements['seed']['reason'],
            $requirements['databases'] === [] => 'This server has no database to move.',
            DatabaseUpgrade::forServer($source) !== null => 'This server is already taking part in an upgrade.',
            isset($plan['disk']) && $plan['disk'] < $requirements['storage_gb'] => 'This plan has '.$plan['disk'].' GB of disk, but the databases of '.$source->name.' need at least '.$requirements['storage_gb'].' GB.',
            default => null,
        };

        if ($error !== null) {
            throw ValidationException::withMessages(['version' => $error]);
        }

        $server = app(CreateServer::class)->create($user, $source->project, [
            'provider' => $provider?->provider,
            'server_provider' => $validated['server_provider'],
            'region' => $validated['region'],
            'plan' => $validated['plan'],
            'name' => $validated['name'],
            'os' => $requirements['os'],
            'role' => ServerRole::DATABASE->value,
            'services' => [
                ['type' => 'database', 'name' => 'postgresql', 'version' => $validated['version']],
                ['type' => 'monitoring', 'name' => 'remote-monitor', 'version' => 'latest'],
            ],
        ]);

        $suffix = Str::lower(Str::random(10));
        $upgrade = DatabaseUpgrade::query()->create([
            'mode' => $validated['mode'],
            'project_id' => $source->project_id,
            'source_server_id' => $source->id,
            'target_server_id' => $server->id,
            'source_version' => (string) $requirements['version'],
            'target_version' => $validated['version'],
            'username' => 'vito_upgrade_'.$suffix,
            'password' => Str::password(40, symbols: false),
            'status' => DatabaseUpgradeStatus::WAITING_FOR_SERVER,
            'step' => 'Creating and installing the new server',
            'preflight' => [
                ...$requirements,
                'replica_identity' => $validated['replica_identity'] ?? 'leave',
                'wal_keep_gb' => (int) $validated['wal_keep_gb'],
            ],
        ]);

        dispatch(new RunDatabaseUpgradeJob($upgrade))->onQueue('ssh')->delay(now()->addMinute());

        return $upgrade;
    }

    public function start(DatabaseUpgrade $upgrade): void
    {
        $server = $upgrade->target ?? throw new RuntimeException('The new server was deleted.');

        if ($server->status === ServerStatus::INSTALLATION_FAILED) {
            throw new RuntimeException('Installing the new server failed. Check its logs, then cancel the upgrade and start it again.');
        }

        if ($server->status !== ServerStatus::READY) {
            if ($upgrade->created_at->lt(now()->subHours(2))) {
                throw new RuntimeException('The new server was not ready within two hours.');
            }

            return;
        }

        $version = (int) ($server->database()?->version ?? 0);

        if ($version !== (int) $upgrade->target_version) {
            throw new RuntimeException('The new server runs PostgreSQL '.$version.' instead of '.$upgrade->target_version.'.');
        }

        $upgrade->update([
            'status' => DatabaseUpgradeStatus::PREPARING,
            'step' => 'Connecting both servers to the private network',
            'configuration' => [...($upgrade->configuration ?? []), 'preparing_since' => now()->toIso8601String()],
        ]);
    }

    public function prepare(DatabaseUpgrade $upgrade): bool
    {
        $source = $upgrade->source ?? throw new RuntimeException('The old server was deleted.');
        $replication = $upgrade->replication();

        if ($upgrade->target === null) {
            throw new RuntimeException('The new server was deleted.');
        }

        $since = $upgrade->configuration['preparing_since'] ?? null;

        if ($since === null) {
            $upgrade->update(['configuration' => [...($upgrade->configuration ?? []), 'preparing_since' => now()->toIso8601String()]]);
            $since = null;
        }

        if ($since !== null && Carbon::parse($since)->lt(now()->subMinutes(30))) {
            throw new RuntimeException('The upgrade did not get past "'.$upgrade->step.'" within 30 minutes.');
        }

        $this->step($upgrade, 'Connecting both servers to the private network');
        if (! app(PrepareDatabaseUpgradeNetwork::class)->prepare($upgrade)) {
            $upgrade->record('Waiting for both servers to become members of the private network.', 'waiting');

            return false;
        }

        $upgrade->record('Both servers are on '.($upgrade->network?->name ?? 'the private network').': '.($upgrade->configuration['source_address'] ?? '?').' and '.($upgrade->configuration['target_address'] ?? '?').'.');

        $this->step($upgrade, 'Making PostgreSQL on '.$source->name.' listen on its private address');
        if (! app(SyncPostgresListenAddresses::class)->ensure($source, $upgrade->configuration['source_address'] ?? null)) {
            $upgrade->record('PostgreSQL on '.$source->name.' does not answer on '.($upgrade->configuration['source_address'] ?? '?').' yet; it is being restarted to listen there.', 'waiting');

            return false;
        }

        $this->step($upgrade, 'Opening the firewall of '.$source->name.' for the new server');
        if (! $this->firewall($upgrade)) {
            $upgrade->record('Waiting for the firewall rule on '.$source->name.' to be applied.', 'waiting');

            return false;
        }

        $this->step($upgrade, 'Creating the replication user and the publications on '.$source->name);
        $settings = $replication->prepareSource();

        $upgrade->update(['configuration' => [
            ...($upgrade->configuration ?? []),
            'source_port' => $settings['port'],
            'source_ssl' => $settings['ssl'],
        ]]);

        $upgrade->record('Publications and the replication user are in place on '.$source->name.' (wal_level '.$settings['wal_level'].', '.$settings['max_replication_slots'].' slots, '.$settings['max_wal_senders'].' senders).');

        if ($settings['wal_level'] !== 'logical'
            || $settings['max_replication_slots'] < $upgrade->preflight['required_slots']
            || $settings['max_wal_senders'] < $upgrade->preflight['required_senders']) {
            $upgrade->record('PostgreSQL on '.$source->name.' needs wal_level logical, '.$upgrade->preflight['required_slots'].' slots and '.$upgrade->preflight['required_senders'].' senders, which only apply after a restart.', 'waiting');

            return $this->restart($upgrade, $source, 'source');
        }

        if ($upgrade->seeded()) {
            $this->step($upgrade, 'Reserving every change '.$source->name.' makes from now on');

            $positions = [...$replication->createSlots(), ...($upgrade->configuration['slot_lsn'] ?? [])];
            $positions = array_filter($positions, fn (string $lsn): bool => $lsn !== '');

            if (count($positions) < count($upgrade->databases())) {
                throw new RuntimeException('Vito could not reserve the changes of every database on '.$source->name.'.');
            }

            $upgrade->update(['configuration' => [...($upgrade->configuration ?? []), 'slot_lsn' => $positions]]);
            $upgrade->record('The new server will start from '.(implode(', ', array_map(
                fn (string $database, string $lsn): string => $database.' at '.$lsn,
                array_keys($positions),
                $positions,
            ))).'.');

            $this->step($upgrade, 'Restoring the backup of '.$source->name.' onto the new server');
            $replication->startSeed(collect($positions)->sortBy(fn (string $lsn): int => self::lsnToInt($lsn))->first());

            $upgrade->update([
                'status' => DatabaseUpgradeStatus::SEEDING,
                'step' => 'Restoring the backup of '.$source->name.' onto the new server',
            ]);

            return true;
        }

        $this->step($upgrade, 'Preparing PostgreSQL on the new server');
        $target = $replication->prepareTargetSettings();
        $count = count($upgrade->databases());

        if ($target['max_logical_replication_workers'] < $count || $target['max_replication_slots'] < $count) {
            $upgrade->record('The new server needs '.$count.' replication workers, which only apply after a restart.', 'waiting');

            return $this->restart($upgrade, $upgrade->target, 'target');
        }

        $this->step($upgrade, 'Copying the roles, the schemas and the first rows');
        $replication->startPrepare();

        $upgrade->update([
            'status' => DatabaseUpgradeStatus::COPYING,
            'step' => 'Copying the roles, the schemas and the first rows',
        ]);

        return true;
    }

    public function monitor(DatabaseUpgrade $upgrade): bool
    {
        if ($upgrade->source === null || $upgrade->target === null) {
            throw new RuntimeException('A server of this upgrade was deleted, so Vito cannot follow the copy.');
        }

        $replication = $upgrade->replication();

        if ($upgrade->status === DatabaseUpgradeStatus::SEEDING) {
            $unit = $replication->seedUnit();
            $state = $unit->state();

            if ($state === 'running') {
                $line = trim(Str::afterLast($unit->output(1, 'cat'), "\n"));
                $upgrade->update(['step' => $line !== '' ? Str::limit($line, 250) : $upgrade->step]);
                $upgrade->record($line !== '' ? Str::limit($line, 250) : 'Restoring the backup onto the new server');

                return false;
            }

            if ($state !== 'succeeded') {
                $reason = $state === 'missing'
                    ? 'Restoring the backup onto the new server stopped before it finished, for example because the server restarted.'
                    : $unit->failureReason();
                $unit->cleanup();
                $this->fail($upgrade, $reason !== '' ? $reason : 'Restoring the backup onto the new server failed.');

                return true;
            }

            $unit->cleanup();
            $upgrade->record('The backup is restored and upgraded to PostgreSQL '.$upgrade->target_version.'.');

            $this->step($upgrade, 'Preparing PostgreSQL on the new server');
            $settings = $replication->prepareTargetSettings();

            if ($settings['max_logical_replication_workers'] < count($upgrade->databases()) || $settings['max_replication_slots'] < count($upgrade->databases())) {
                return $this->restart($upgrade, $upgrade->target, 'target');
            }

            $this->step($upgrade, 'Following the changes '.$upgrade->source->name.' made since the backup');
            $replication->subscribeSeeded();

            $upgrade->update([
                'status' => DatabaseUpgradeStatus::COPYING,
                'step' => 'Catching up with '.$upgrade->source->name,
                'configuration' => [...($upgrade->configuration ?? []), 'copy_prepared' => true],
            ]);
            $upgrade->record('The new server is catching up with everything '.$upgrade->source->name.' did since the backup.');

            return false;
        }

        if ($upgrade->status === DatabaseUpgradeStatus::COPYING && ! ($upgrade->configuration['copy_prepared'] ?? false)) {
            $unit = $replication->prepareUnit();
            $state = $unit->state();

            if ($state === 'running') {
                $line = trim(Str::afterLast($unit->output(1, 'cat'), "\n"));
                $upgrade->update(['step' => $line !== '' ? Str::limit($line, 250) : $upgrade->step]);

                return false;
            }

            if ($state !== 'succeeded') {
                $upgrade->record('The copy on the new server stopped.', 'error');
                $reason = $state === 'missing'
                    ? 'The copy on the new server stopped before it finished, for example because the server restarted.'
                    : $unit->failureReason();
                $unit->cleanup();
                $this->fail($upgrade, $reason !== '' ? $reason : 'Preparing the new server failed.');

                return true;
            }

            $unit->cleanup();
            $upgrade->update(['configuration' => [...($upgrade->configuration ?? []), 'copy_prepared' => true]]);
            $upgrade->record('The roles, the databases and the schemas are on the new server; it is catching up now.');
        }

        $databases = $replication->targetStatus();
        $slots = $replication->sourceStatus()['slots'];
        $tables = (int) array_sum(array_column($databases, 'tables'));
        $copied = (int) array_sum(array_column($databases, 'copied'));
        $errors = (int) array_sum(array_column($databases, 'errors'));
        $lag = (int) array_sum(array_column($slots, 'lag_bytes'));
        $inactive = array_values(array_filter($slots, fn (array $slot): bool => ! $slot['active']));

        $upgrade->update(['configuration' => [
            ...($upgrade->configuration ?? []),
            'tables' => $tables,
            'copied' => $copied,
            'lag_bytes' => $lag,
            'databases' => $databases,
        ]]);

        if ($errors > 0) {
            $upgrade->record('The new server reported '.$errors.' replication errors; its PostgreSQL log holds the cause.', 'error');
            $upgrade->update(['message' => 'PostgreSQL on the new server reported '.$errors.' replication errors. Check its PostgreSQL log; the copy retries until the cause is gone.']);
        } elseif ($upgrade->message !== null) {
            $upgrade->update(['message' => null]);
        }

        $lost = array_values(array_filter($slots, fn (array $slot): bool => $slot['wal_status'] === 'lost'));
        $unreserved = array_values(array_filter($slots, fn (array $slot): bool => $slot['wal_status'] === 'unreserved'));

        if ($lost !== []) {
            $this->fail($upgrade, 'The old server dropped WAL the copy had not applied yet, because the new server fell more than '.($upgrade->preflight['wal_keep_gb'] ?? '?').' GB behind. Nothing on '.$upgrade->source->name.' was changed; cancel this upgrade and start it again, with a larger allowance or less load.');

            return true;
        }

        if ($unreserved !== []) {
            $upgrade->record('The new server is close to the '.($upgrade->preflight['wal_keep_gb'] ?? '?').' GB of WAL the old one keeps for it; if it falls further behind, the copy has to start again.', 'error');
        }

        if (count($slots) < count($upgrade->databases()) && $upgrade->status === DatabaseUpgradeStatus::STREAMING) {
            $this->fail($upgrade, 'A replication slot of this upgrade disappeared from '.$upgrade->source->name.', so the new server is no longer in sync.');

            return true;
        }

        $synced = $databases !== [] && $tables === $copied && $inactive === [] && $errors === 0 && $lag < 16777216;

        if ($synced && $upgrade->status !== DatabaseUpgradeStatus::STREAMING) {
            $upgrade->update([
                'status' => DatabaseUpgradeStatus::STREAMING,
                'step' => null,
                'caught_up_at' => now(),
            ]);
            $upgrade->record('Every table is copied and the new server keeps up; it is ready for the switch.');
            Notifier::send($upgrade->source, new DatabaseUpgradeUpdated($upgrade));

            return false;
        }

        if (! $synced && $upgrade->status === DatabaseUpgradeStatus::COPYING) {
            $upgrade->update(['step' => 'Copying '.$copied.' of '.$tables.' tables']);
            $upgrade->record('Copied '.$copied.' of '.$tables.' tables, '.(round($lag / 1048576, 1)).' MB of changes behind.');
        }

        return false;
    }

    public function output(DatabaseUpgrade $upgrade): string
    {
        if ($upgrade->target === null) {
            return 'The new server was deleted.';
        }

        try {
            $output = $upgrade->replication()->prepareUnit()->output(400, 'cat');
        } catch (SSHError $e) {
            return 'Vito could not read the copy output from '.$upgrade->target->name.': '.$e->getMessage();
        }

        return $output !== '' && ! str_contains($output, '-- No entries --')
            ? $output
            : 'The copy on '.$upgrade->target->name.' has not written any output yet.';
    }

    public function finish(DatabaseUpgrade $upgrade): void
    {
        if ($upgrade->status !== DatabaseUpgradeStatus::STREAMING) {
            throw ValidationException::withMessages([
                'upgrade' => 'The new server is not in sync yet, so it cannot take over.',
            ]);
        }

        $upgrade->update([
            'status' => DatabaseUpgradeStatus::FINISHING,
            'step' => 'Blocking new writes on '.$upgrade->source->name,
            'message' => null,
        ]);

        dispatch(new FinishDatabaseUpgradeJob($upgrade))->onQueue('ssh');
    }

    public function runFinish(DatabaseUpgrade $upgrade): void
    {
        $replication = $upgrade->replication();
        $expected = count($upgrade->databases());

        $this->stage($upgrade, 'cutover');
        $this->step($upgrade, 'Blocking new writes on '.$upgrade->source->name.' and waiting for the last rows');
        $cutover = $replication->cutover();

        if ($cutover['slots'] < $expected) {
            throw new RuntimeException('Vito expected '.$expected.' replication slots on '.$upgrade->source->name.' but found '.$cutover['slots'].', so the new server may be missing rows.');
        }

        if ($cutover['remaining'] !== 0) {
            throw new RuntimeException('The new server did not apply everything within ten minutes. '.$upgrade->source->name.' stays read-only; check the replication on the new server and finish again.');
        }

        $this->stage($upgrade, 'switch');
        $this->step($upgrade, 'Copying the sequence values and stopping the copy');
        $replication->finish(true);

        $this->stage($upgrade, 'cleanup');
        $this->step($upgrade, 'Cleaning up '.$upgrade->source->name);
        $replication->cleanupSource(false);
        $this->release($upgrade);

        rescue(function () use ($upgrade): void {
            app(SyncDatabases::class)->sync($upgrade->target);
            app(SyncDatabaseUsers::class)->sync($upgrade->target);
        });

        $upgrade->update([
            'status' => DatabaseUpgradeStatus::COMPLETED,
            'step' => null,
            'finished_at' => now(),
        ]);
        $upgrade->record('The switch finished at '.$cutover['lsn'].'; '.$upgrade->source->name.' no longer takes writes.');

        Notifier::send($upgrade->target, new DatabaseUpgradeUpdated($upgrade));
    }

    public function cancel(DatabaseUpgrade $upgrade): void
    {
        if ($upgrade->status === DatabaseUpgradeStatus::FINISHING || $upgrade->status === DatabaseUpgradeStatus::CANCELLING) {
            throw ValidationException::withMessages([
                'upgrade' => 'Wait for the current step of this upgrade to finish.',
            ]);
        }

        if (in_array($upgrade->status, [DatabaseUpgradeStatus::COMPLETED, DatabaseUpgradeStatus::CANCELLED], true)) {
            throw ValidationException::withMessages([
                'upgrade' => 'This upgrade is already finished.',
            ]);
        }

        $upgrade->update([
            'status' => DatabaseUpgradeStatus::CANCELLING,
            'step' => 'Stopping the copy and cleaning up both servers',
        ]);

        dispatch(new CancelDatabaseUpgradeJob($upgrade))->onQueue('ssh');
    }

    public function runCancel(DatabaseUpgrade $upgrade): void
    {
        $replication = $upgrade->replication();

        rescue(fn () => $replication->prepareUnit()->cleanup());

        if ($upgrade->target?->status === ServerStatus::READY) {
            $replication->finish(false);
        }

        $replication->cleanupSource(true);
        $this->release($upgrade);

        $upgrade->update([
            'status' => DatabaseUpgradeStatus::CANCELLED,
            'step' => null,
            'finished_at' => now(),
        ]);
        $upgrade->record('The upgrade was cancelled and '.($upgrade->source?->name ?? 'the old server').' takes writes again.');
    }

    public function delete(DatabaseUpgrade $upgrade): void
    {
        if ($upgrade->status->isActive() || $upgrade->status === DatabaseUpgradeStatus::CANCELLING) {
            throw ValidationException::withMessages([
                'upgrade' => 'Cancel this upgrade before removing it.',
            ]);
        }

        $upgrade->delete();
    }

    public function fail(DatabaseUpgrade $upgrade, string $message): void
    {
        $upgrade->record($message, 'error');
        $upgrade->update([
            'status' => DatabaseUpgradeStatus::FAILED,
            'step' => null,
            'message' => Str::limit($message, 2000),
            'finished_at' => now(),
        ]);

        Notifier::send($upgrade->source, new DatabaseUpgradeUpdated($upgrade));
    }

    private function release(DatabaseUpgrade $upgrade): void
    {
        FirewallRule::query()
            ->where('note', 'vito-pg-upgrade:'.$upgrade->id.':5432')
            ->where('status', '!=', FirewallRuleStatus::DELETING)
            ->get()
            ->each(fn (FirewallRule $rule) => app(ManageRule::class)->delete($rule));

        app(PrepareDatabaseUpgradeNetwork::class)->release($upgrade);
    }

    private function firewall(DatabaseUpgrade $upgrade): bool
    {
        $source = $upgrade->source;
        $address = $upgrade->configuration['target_address'] ?? null;

        if (! $source->firewall() || $address === null) {
            return true;
        }

        $note = 'vito-pg-upgrade:'.$upgrade->id.':5432';
        $rule = FirewallRule::query()->where('note', $note)->where('status', '!=', FirewallRuleStatus::DELETING)->first();

        if ($rule !== null && $rule->source !== $address) {
            app(ManageRule::class)->delete($rule);
            $rule = null;
        }

        if ($rule === null) {
            $rule = app(ManageRule::class)->create($source, [
                'name' => 'postgres-upgrade',
                'type' => 'allow',
                'protocol' => 'tcp',
                'port' => '5432',
                'source_any' => false,
                'source' => $address,
                'mask' => Str::contains($address, ':') ? 128 : 32,
            ]);
            $rule->update(['note' => $note]);
        }

        if ($rule->status === FirewallRuleStatus::FAILED) {
            throw new RuntimeException('Opening the firewall of '.$source->name.' for the new server failed.');
        }

        return $rule->status === FirewallRuleStatus::READY;
    }

    private function restart(DatabaseUpgrade $upgrade, Server $server, string $key): bool
    {
        $service = $server->database() ?? throw new RuntimeException('PostgreSQL is not installed on '.$server->name.'.');
        $restarts = (int) ($upgrade->configuration[$key.'_restarts'] ?? 0);

        if ($service->status === ServiceStatus::FAILED) {
            throw new RuntimeException('PostgreSQL on '.$server->name.' is not running.');
        }

        if (! in_array($service->status, SyncServiceStatus::SETTLED_STATUSES, true)) {
            return false;
        }

        if ($restarts >= 3) {
            throw new RuntimeException('PostgreSQL on '.$server->name.' still does not have the settings logical replication needs after restarting.');
        }

        $upgrade->update([
            'configuration' => [...($upgrade->configuration ?? []), $key.'_restarts' => $restarts + 1],
            'step' => 'Restarting PostgreSQL on '.$server->name,
        ]);

        $upgrade->record('Restarting PostgreSQL on '.$server->name.' (attempt '.($restarts + 1).' of 3).', 'waiting');
        app(Manage::class)->restart($service);

        return false;
    }

    private function stage(DatabaseUpgrade $upgrade, string $stage): void
    {
        $upgrade->update(['configuration' => [...($upgrade->configuration ?? []), 'finish_stage' => $stage]]);
    }

    private function step(DatabaseUpgrade $upgrade, string $step): void
    {
        $upgrade->update(['step' => $step]);
        $upgrade->record($step);
    }

    private function warnings(Server $source, array $inspect): array
    {
        $sum = fn (string $key): int => (int) array_sum(array_column($inspect['databases'], $key));
        $extensions = collect($inspect['databases'])->pluck('extensions')->flatten()->unique()->sort()->values();
        $replicas = PostgresCluster::forServer($source)?->streamingReplicas()->count() ?? 0;

        return array_values(array_filter([
            $replicas === 0 ? null : ($replicas === 1 ? 'The streaming replica of this server keeps following it, not the new server. Build a replica of the new server after the switch.' : strtr('The :count streaming replicas of this server keep following it, not the new server. Build replicas of the new server after the switch.', [':count' => $replicas])),
            $sum('without_key') === 0 ? null : ($sum('without_key') === 1 ? 'While the copy runs, UPDATE and DELETE fail on the one table that has no primary key. Let Vito set REPLICA IDENTITY FULL on it, or give it a primary key first.' : strtr('While the copy runs, UPDATE and DELETE fail on the :count tables that have no primary key. Let Vito set REPLICA IDENTITY FULL on them, or give them a primary key first.', [':count' => $sum('without_key')])),
            $sum('unlogged') === 0 ? null : ($sum('unlogged') === 1 ? 'The one unlogged table is created empty on the new server: logical replication never copies its rows.' : strtr('The :count unlogged tables are created empty on the new server: logical replication never copies their rows.', [':count' => $sum('unlogged')])),
            $sum('materialized_views') === 0 ? null : ($sum('materialized_views') === 1 ? 'The one materialized view is created empty. Run REFRESH MATERIALIZED VIEW on the new server after the switch.' : strtr('The :count materialized views are created empty. Run REFRESH MATERIALIZED VIEW on the new server after the switch.', [':count' => $sum('materialized_views')])),
            $sum('large_objects') === 0 ? null : ($sum('large_objects') === 1 ? 'The one large object is not copied. Move it yourself if your application uses it.' : strtr('The :count large objects are not copied. Move them yourself if your application uses them.', [':count' => $sum('large_objects')])),
            $extensions->isEmpty() ? null : ($extensions->count() === 1 ? 'The extension :names must exist for PostgreSQL on the new server, else copying the schema fails.' : strtr('The extensions :names must exist for PostgreSQL on the new server, else copying the schema fails.', [':count' => $extensions->count(), ':names' => $extensions->implode(', ')])),
            'Tables created on the old server after the copy starts are not copied. Hold your migrations until the switch.',
        ]));
    }

    private static function lsnToInt(string $lsn): int
    {
        [$high, $low] = array_pad(explode('/', $lsn, 2), 2, '0');

        return (hexdec($high) << 32) | hexdec($low);
    }
}
