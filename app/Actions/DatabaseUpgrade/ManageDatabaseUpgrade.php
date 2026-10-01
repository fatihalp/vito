<?php

namespace App\Actions\DatabaseUpgrade;

use App\Actions\Database\SyncDatabases;
use App\Actions\Database\SyncDatabaseUsers;
use App\Actions\FirewallRule\ManageRule;
use App\Actions\PostgresCluster\SyncPostgresListenAddresses;
use App\Actions\Server\CreateServer;
use App\Actions\Service\Manage;
use App\Actions\Service\SyncServiceStatus;
use App\Enums\DatabaseUpgradeStatus;
use App\Enums\FirewallRuleStatus;
use App\Enums\ServerRole;
use App\Enums\ServerStatus;
use App\Enums\ServiceStatus;
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

/**
 * Moves every database of a PostgreSQL server to a new server running a newer major version, with logical replication.
 * The old server keeps serving while the copy runs; the admin decides when to switch over.
 */
class ManageDatabaseUpgrade
{
    /**
     * What an upgrade of this server would involve: the databases it moves, what the new server needs, the one restart
     * it may cost, and what logical replication does not copy. Only reads from the server.
     *
     * @return array{version: int, versions: list<string>, databases: list<array<string, mixed>>, database_size: int, storage_gb: int, cores: ?int, memory_gb: ?float, os: string, source: string, restart_needed: bool, read_only: bool, wal_level: string, required_slots: int, required_senders: int, tables_without_key: list<string>, tables_without_key_count: int, warnings: list<string>}
     */
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
            'required_slots' => $slots,
            'required_senders' => $senders,
            'tables_without_key' => $inspect['tables_without_key'],
            'tables_without_key_count' => (int) array_sum(array_column($inspect['databases'], 'without_key')),
            'warnings' => $this->warnings($source, $inspect),
        ];
    }

    /**
     * The versions this server could move to, from what Vito already knows about it. Needs no connection, so the dialog
     * can offer them while the deeper check still runs.
     *
     * @return array{version: int, versions: list<string>, source: string}
     */
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
        ], [
            'restart.accepted' => __('PostgreSQL on :source needs settings that only apply after a restart, so confirm the restart.', ['source' => $source->name]),
        ])->validate();

        $provider = ServerProvider::query()->find($validated['server_provider']);
        $plan = rescue(fn (): ?array => $provider?->provider()->plans($validated['region'])[$validated['plan']] ?? null, null, false);

        $error = match (true) {
            $source->database()?->name !== 'postgresql' => __('Only a PostgreSQL server can be upgraded this way.'),
            $requirements['databases'] === [] => __('This server has no database to move.'),
            DatabaseUpgrade::forServer($source) !== null => __('This server is already taking part in an upgrade.'),
            isset($plan['disk']) && $plan['disk'] < $requirements['storage_gb'] => __('This plan has :disk GB of disk, but the databases of :source need at least :required GB.', [
                'disk' => $plan['disk'],
                'source' => $source->name,
                'required' => $requirements['storage_gb'],
            ]),
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
            'project_id' => $source->project_id,
            'source_server_id' => $source->id,
            'target_server_id' => $server->id,
            'source_version' => (string) $requirements['version'],
            'target_version' => $validated['version'],
            'username' => 'vito_upgrade_'.$suffix,
            'password' => Str::password(40, symbols: false),
            'status' => DatabaseUpgradeStatus::WAITING_FOR_SERVER,
            'step' => __('Creating and installing the new server'),
            'preflight' => [
                ...$requirements,
                'replica_identity' => $validated['replica_identity'] ?? 'leave',
            ],
        ]);

        dispatch(new RunDatabaseUpgradeJob($upgrade))->onQueue('ssh')->delay(now()->addMinute());

        return $upgrade;
    }

    /**
     * Starts the upgrade once the new server is installed; does nothing while it is still being installed.
     */
    public function start(DatabaseUpgrade $upgrade): void
    {
        $server = $upgrade->target ?? throw new RuntimeException(__('The new server was deleted.'));

        if ($server->status === ServerStatus::INSTALLATION_FAILED) {
            throw new RuntimeException(__('Installing the new server failed. Check its logs, then cancel the upgrade and start it again.'));
        }

        if ($server->status !== ServerStatus::READY) {
            if ($upgrade->created_at->lt(now()->subHours(2))) {
                throw new RuntimeException(__('The new server was not ready within two hours.'));
            }

            return;
        }

        $version = (int) ($server->database()?->version ?? 0);

        if ($version !== (int) $upgrade->target_version) {
            throw new RuntimeException(__('The new server runs PostgreSQL :version instead of :expected.', ['version' => $version, 'expected' => $upgrade->target_version]));
        }

        $upgrade->update([
            'status' => DatabaseUpgradeStatus::PREPARING,
            'step' => __('Connecting both servers to the private network'),
            'configuration' => [...($upgrade->configuration ?? []), 'preparing_since' => now()->toIso8601String()],
        ]);
    }

    /**
     * Prepares both servers and starts the first copy. Returns false while a step is still being applied.
     */
    public function prepare(DatabaseUpgrade $upgrade): bool
    {
        $source = $upgrade->source ?? throw new RuntimeException(__('The old server was deleted.'));
        $replication = $upgrade->replication();

        if ($upgrade->target === null) {
            throw new RuntimeException(__('The new server was deleted.'));
        }

        // Every step here waits for something — a network, a restart, a firewall rule — by answering "not yet" and
        // being asked again a minute later. A step that can never finish would otherwise wait for ever, showing the
        // admin a status that never moves and no reason at all.
        $since = $upgrade->configuration['preparing_since'] ?? null;

        if ($since !== null && Carbon::parse($since)->lt(now()->subMinutes(30))) {
            throw new RuntimeException(__('The upgrade did not get past ":step" within 30 minutes.', ['step' => $upgrade->step]));
        }

        $this->step($upgrade, __('Connecting both servers to the private network'));
        if (! app(PrepareDatabaseUpgradeNetwork::class)->prepare($upgrade)) {
            return false;
        }

        $this->step($upgrade, __('Making PostgreSQL on :server listen on its private address', ['server' => $source->name]));
        if (! app(SyncPostgresListenAddresses::class)->ensure($source, $upgrade->configuration['source_address'] ?? null)) {
            return false;
        }

        $this->step($upgrade, __('Opening the firewall of :server for the new server', ['server' => $source->name]));
        if (! $this->firewall($upgrade)) {
            return false;
        }

        $this->step($upgrade, __('Creating the replication user and the publications on :server', ['server' => $source->name]));
        $settings = $replication->prepareSource();

        $upgrade->update(['configuration' => [
            ...($upgrade->configuration ?? []),
            'source_port' => $settings['port'],
            'source_ssl' => $settings['ssl'],
        ]]);

        if ($settings['wal_level'] !== 'logical'
            || $settings['max_replication_slots'] < $upgrade->preflight['required_slots']
            || $settings['max_wal_senders'] < $upgrade->preflight['required_senders']) {
            return $this->restart($upgrade, $source, 'source');
        }

        $this->step($upgrade, __('Preparing PostgreSQL on the new server'));
        $target = $replication->prepareTargetSettings();
        $count = count($upgrade->databases());

        if ($target['max_logical_replication_workers'] < $count || $target['max_replication_slots'] < $count) {
            return $this->restart($upgrade, $upgrade->target, 'target');
        }

        $this->step($upgrade, __('Copying the roles, the schemas and the first rows'));
        $replication->startPrepare();

        $upgrade->update([
            'status' => DatabaseUpgradeStatus::COPYING,
            'step' => __('Copying the roles, the schemas and the first rows'),
        ]);

        return true;
    }

    /**
     * Follows the copy and reports when the new server holds everything. Returns true when the upgrade stopped.
     */
    public function monitor(DatabaseUpgrade $upgrade): bool
    {
        if ($upgrade->source === null || $upgrade->target === null) {
            throw new RuntimeException(__('A server of this upgrade was deleted, so Vito cannot follow the copy.'));
        }

        $replication = $upgrade->replication();

        if ($upgrade->status === DatabaseUpgradeStatus::COPYING) {
            $unit = $replication->prepareUnit();
            $state = $unit->state();

            if ($state === 'running') {
                $line = trim(Str::afterLast($unit->output(1, 'cat'), "\n"));
                $upgrade->update(['step' => $line !== '' ? Str::limit($line, 250) : $upgrade->step]);

                return false;
            }

            if ($state !== 'succeeded') {
                $reason = $state === 'missing'
                    ? __('The copy on the new server stopped before it finished, for example because the server restarted.')
                    : $unit->failureReason();
                $unit->cleanup();
                $this->fail($upgrade, $reason !== '' ? $reason : __('Preparing the new server failed.'));

                return true;
            }

            $unit->cleanup();
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
            $upgrade->update(['message' => __('PostgreSQL on the new server reported :errors replication errors. Check its PostgreSQL log; the copy retries until the cause is gone.', ['errors' => $errors])]);
        } elseif ($upgrade->message !== null) {
            $upgrade->update(['message' => null]);
        }

        if (count($slots) < count($upgrade->databases()) && $upgrade->status === DatabaseUpgradeStatus::STREAMING) {
            $this->fail($upgrade, __('A replication slot of this upgrade disappeared from :server, so the new server is no longer in sync.', ['server' => $upgrade->source->name]));

            return true;
        }

        $synced = $databases !== [] && $tables === $copied && $inactive === [] && $errors === 0 && $lag < 16777216;

        if ($synced && $upgrade->status !== DatabaseUpgradeStatus::STREAMING) {
            $upgrade->update([
                'status' => DatabaseUpgradeStatus::STREAMING,
                'step' => null,
                'caught_up_at' => now(),
            ]);
            Notifier::send($upgrade->source, new DatabaseUpgradeUpdated($upgrade));

            return false;
        }

        if (! $synced && $upgrade->status === DatabaseUpgradeStatus::COPYING) {
            $upgrade->update(['step' => __('Copying :copied of :tables tables', ['copied' => $copied, 'tables' => $tables])]);
        }

        return false;
    }

    /**
     * Switches over: this is the moment the old server stops taking writes.
     */
    public function finish(DatabaseUpgrade $upgrade): void
    {
        if ($upgrade->status !== DatabaseUpgradeStatus::STREAMING) {
            throw ValidationException::withMessages([
                'upgrade' => __('The new server is not in sync yet, so it cannot take over.'),
            ]);
        }

        $upgrade->update([
            'status' => DatabaseUpgradeStatus::FINISHING,
            'step' => __('Blocking new writes on :server', ['server' => $upgrade->source->name]),
            'message' => null,
        ]);

        dispatch(new FinishDatabaseUpgradeJob($upgrade))->onQueue('ssh');
    }

    public function runFinish(DatabaseUpgrade $upgrade): void
    {
        $replication = $upgrade->replication();
        $expected = count($upgrade->databases());

        $this->stage($upgrade, 'cutover');
        $this->step($upgrade, __('Blocking new writes on :server and waiting for the last rows', ['server' => $upgrade->source->name]));
        $cutover = $replication->cutover();

        if ($cutover['slots'] < $expected) {
            throw new RuntimeException(__('Vito expected :expected replication slots on :server but found :found, so the new server may be missing rows.', [
                'expected' => $expected,
                'server' => $upgrade->source->name,
                'found' => $cutover['slots'],
            ]));
        }

        if ($cutover['remaining'] !== 0) {
            throw new RuntimeException(__('The new server did not apply everything within ten minutes. :server stays read-only; check the replication on the new server and finish again.', [
                'server' => $upgrade->source->name,
            ]));
        }

        $this->stage($upgrade, 'switch');
        $this->step($upgrade, __('Copying the sequence values and stopping the copy'));
        $replication->finish(true);

        $this->stage($upgrade, 'cleanup');
        $this->step($upgrade, __('Cleaning up :server', ['server' => $upgrade->source->name]));
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

        Notifier::send($upgrade->target, new DatabaseUpgradeUpdated($upgrade));
    }

    /**
     * Stops the copy and puts the old server back the way it was. The new server is kept; delete it when it is not needed.
     */
    public function cancel(DatabaseUpgrade $upgrade): void
    {
        if ($upgrade->status === DatabaseUpgradeStatus::FINISHING || $upgrade->status === DatabaseUpgradeStatus::CANCELLING) {
            throw ValidationException::withMessages([
                'upgrade' => __('Wait for the current step of this upgrade to finish.'),
            ]);
        }

        if (in_array($upgrade->status, [DatabaseUpgradeStatus::COMPLETED, DatabaseUpgradeStatus::CANCELLED], true)) {
            throw ValidationException::withMessages([
                'upgrade' => __('This upgrade is already finished.'),
            ]);
        }

        $upgrade->update([
            'status' => DatabaseUpgradeStatus::CANCELLING,
            'step' => __('Stopping the copy and cleaning up both servers'),
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
    }

    public function delete(DatabaseUpgrade $upgrade): void
    {
        if ($upgrade->status->isActive() || $upgrade->status === DatabaseUpgradeStatus::CANCELLING) {
            throw ValidationException::withMessages([
                'upgrade' => __('Cancel this upgrade before removing it.'),
            ]);
        }

        $upgrade->delete();
    }

    public function fail(DatabaseUpgrade $upgrade, string $message): void
    {
        $upgrade->update([
            'status' => DatabaseUpgradeStatus::FAILED,
            'step' => null,
            'message' => Str::limit($message, 2000),
            'finished_at' => now(),
        ]);

        Notifier::send($upgrade->source, new DatabaseUpgradeUpdated($upgrade));
    }

    /**
     * Removes the firewall rule and the private network Vito created only for this upgrade.
     */
    private function release(DatabaseUpgrade $upgrade): void
    {
        FirewallRule::query()
            ->where('note', 'vito-pg-upgrade:'.$upgrade->id.':5432')
            ->where('status', '!=', FirewallRuleStatus::DELETING)
            ->get()
            ->each(fn (FirewallRule $rule) => app(ManageRule::class)->delete($rule));

        app(PrepareDatabaseUpgradeNetwork::class)->release($upgrade);
    }

    /**
     * Lets the new server reach PostgreSQL on the old one. Returns false until the rule is applied.
     */
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
            throw new RuntimeException(__('Opening the firewall of :server for the new server failed.', ['server' => $source->name]));
        }

        return $rule->status === FirewallRuleStatus::READY;
    }

    /**
     * Restarts PostgreSQL once so the settings logical replication needs apply. Always returns false: the next run
     * checks the settings again.
     */
    private function restart(DatabaseUpgrade $upgrade, Server $server, string $key): bool
    {
        $service = $server->database() ?? throw new RuntimeException(__('PostgreSQL is not installed on :server.', ['server' => $server->name]));
        $restarts = (int) ($upgrade->configuration[$key.'_restarts'] ?? 0);

        if ($service->status === ServiceStatus::FAILED) {
            throw new RuntimeException(__('PostgreSQL on :server is not running.', ['server' => $server->name]));
        }

        if (! in_array($service->status, SyncServiceStatus::SETTLED_STATUSES, true)) {
            return false;
        }

        if ($restarts >= 3) {
            throw new RuntimeException(__('PostgreSQL on :server still does not have the settings logical replication needs after restarting.', ['server' => $server->name]));
        }

        $upgrade->update([
            'configuration' => [...($upgrade->configuration ?? []), $key.'_restarts' => $restarts + 1],
            'step' => __('Restarting PostgreSQL on :server', ['server' => $server->name]),
        ]);

        app(Manage::class)->restart($service);

        return false;
    }

    /**
     * Records how far the switch got, so a failure before the old server stops taking writes can be retried.
     */
    private function stage(DatabaseUpgrade $upgrade, string $stage): void
    {
        $upgrade->update(['configuration' => [...($upgrade->configuration ?? []), 'finish_stage' => $stage]]);
    }

    private function step(DatabaseUpgrade $upgrade, string $step): void
    {
        $upgrade->update(['step' => $step]);
    }

    /**
     * @param  array<string, mixed>  $inspect
     * @return list<string>
     */
    private function warnings(Server $source, array $inspect): array
    {
        $sum = fn (string $key): int => (int) array_sum(array_column($inspect['databases'], $key));
        $extensions = collect($inspect['databases'])->pluck('extensions')->flatten()->unique()->sort()->values();
        $replicas = PostgresCluster::forServer($source)?->streamingReplicas()->count() ?? 0;

        return array_values(array_filter([
            $replicas === 0 ? null : trans_choice('{1}The streaming replica of this server keeps following it, not the new server. Build a replica of the new server after the switch.|[2,*]The :count streaming replicas of this server keep following it, not the new server. Build replicas of the new server after the switch.', $replicas),
            $sum('without_key') === 0 ? null : trans_choice('{1}While the copy runs, UPDATE and DELETE fail on the one table that has no primary key. Let Vito set REPLICA IDENTITY FULL on it, or give it a primary key first.|[2,*]While the copy runs, UPDATE and DELETE fail on the :count tables that have no primary key. Let Vito set REPLICA IDENTITY FULL on them, or give them a primary key first.', $sum('without_key')),
            $sum('unlogged') === 0 ? null : trans_choice('{1}The one unlogged table is created empty on the new server: logical replication never copies its rows.|[2,*]The :count unlogged tables are created empty on the new server: logical replication never copies their rows.', $sum('unlogged')),
            $sum('materialized_views') === 0 ? null : trans_choice('{1}The one materialized view is created empty. Run REFRESH MATERIALIZED VIEW on the new server after the switch.|[2,*]The :count materialized views are created empty. Run REFRESH MATERIALIZED VIEW on the new server after the switch.', $sum('materialized_views')),
            $sum('large_objects') === 0 ? null : trans_choice('{1}The one large object is not copied. Move it yourself if your application uses it.|[2,*]The :count large objects are not copied. Move them yourself if your application uses them.', $sum('large_objects')),
            $extensions->isEmpty() ? null : trans_choice('{1}The extension :names must exist for PostgreSQL on the new server, else copying the schema fails.|[2,*]The extensions :names must exist for PostgreSQL on the new server, else copying the schema fails.', $extensions->count(), ['names' => $extensions->implode(', ')]),
            __('Tables created on the old server after the copy starts are not copied. Hold your migrations until the switch.'),
        ]));
    }
}
