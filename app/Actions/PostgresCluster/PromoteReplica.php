<?php

namespace App\Actions\PostgresCluster;

use App\Actions\Backup\ManagePgBackRest;
use App\Actions\DatabaseReplica\BroadcastDatabaseReplicaUpdate;
use App\Actions\DatabaseReplica\ManageDatabaseReplica;
use App\DTOs\SocketEventDTO;
use App\Enums\DatabaseReplicaHealth;
use App\Enums\DatabaseReplicaStatus;
use App\Enums\PostgresClusterStatus;
use App\Events\SocketEvent;
use App\Exceptions\PostgresFailoverAborted;
use App\Exceptions\SSHError;
use App\Facades\Notifier;
use App\Http\Resources\PostgresClusterResource;
use App\Jobs\DatabaseReplica\CheckDatabaseReplicaJob;
use App\Jobs\PostgresCluster\PromoteReplicaJob;
use App\Models\DatabaseReplica;
use App\Models\PostgresCluster;
use App\Models\Server;
use App\Models\ServerLog;
use App\Notifications\DatabaseReplicaFailed;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Fails a cluster over to one of its replicas. Every step records a checkpoint in postgres_clusters.failover,
 * so a failed run resumes from the last finished step instead of repeating or undoing work.
 */
class PromoteReplica
{
    public function promote(DatabaseReplica $candidate, array $input): void
    {
        if (! config('database-replication.failover_enabled')) {
            throw ValidationException::withMessages([
                'replica' => __('Failover is turned off on this Vito installation.'),
            ]);
        }

        $validated = Validator::make($input, [
            'force' => ['sometimes', 'boolean'],
            'confirmation' => ['required', 'string', Rule::in([$candidate->replica->name])],
        ], [
            'confirmation.in' => __('Type the replica server name exactly to confirm the failover.'),
        ])->validate();
        $force = (bool) ($validated['force'] ?? false);
        $cluster = $candidate->cluster;

        if ($cluster->status !== PostgresClusterStatus::ACTIVE || $candidate->status !== DatabaseReplicaStatus::READY) {
            throw ValidationException::withMessages([
                'replica' => __('Only a ready replica of an active cluster can be promoted.'),
            ]);
        }

        $lag = $candidate->latestMetric?->lag_bytes;

        if (! $force && ($candidate->health === DatabaseReplicaHealth::CRITICAL || ($lag !== null && $lag >= config('database-replication.lag_critical_mb') * 1048576))) {
            throw ValidationException::withMessages([
                'force' => __('This replica is critical or far behind, so recent commits may be lost. Confirm to promote it anyway.'),
            ]);
        }

        $backup = $cluster->backup;

        $cluster->update([
            'status' => PostgresClusterStatus::FAILING_OVER,
            'failover' => [
                'step' => 'started',
                'replica_id' => $candidate->id,
                'server_id' => $candidate->replica_server_id,
                'old_primary_id' => $cluster->primary_server_id,
                'old_pg_path' => $backup->configuration['pg_path'],
                'old_pg_port' => $backup->configuration['pg_port'],
                'new_pg_path' => $candidate->configuration['replica']['data_directory'],
                'new_pg_port' => $candidate->configuration['replica']['port'],
                'max_slot_wal_keep_size_gb' => $candidate->max_slot_wal_keep_size_gb,
                'force' => $force,
                'fenced' => null,
                'error' => null,
                'started_at' => now()->toIso8601String(),
            ],
        ]);
        $candidate->update(['status' => DatabaseReplicaStatus::PROMOTING, 'message' => null]);

        $this->broadcast($cluster);
        dispatch(new PromoteReplicaJob($cluster))->onQueue('ssh');
    }

    public function retry(PostgresCluster $cluster, array $input): void
    {
        $validated = Validator::make($input, ['force' => ['sometimes', 'boolean']])->validate();

        if ($cluster->status !== PostgresClusterStatus::FAILING_OVER || ! isset($cluster->failover['error'])) {
            throw ValidationException::withMessages([
                'cluster' => __('There is no stopped failover to continue.'),
            ]);
        }

        $cluster->update(['failover' => [
            ...$cluster->failover,
            'error' => null,
            'force' => $cluster->failover['force'] || (bool) ($validated['force'] ?? false),
        ]]);

        $this->broadcast($cluster);
        dispatch(new PromoteReplicaJob($cluster))->onQueue('ssh');
    }

    public function run(PostgresCluster $cluster): void
    {
        $state = $cluster->failover;
        $newPrimary = Server::query()->findOrFail($state['server_id']);
        $oldPrimary = Server::query()->findOrFail($state['old_primary_id']);

        if ($state['step'] === 'started') {
            $fenced = true;

            try {
                app(FencePostgresNode::class)->fence($oldPrimary);
            } catch (SSHError $e) {
                if (! $state['force']) {
                    throw new PostgresFailoverAborted(__('Vito could not reach the old primary :server to stop it: :error. If it is down, fail over again and confirm that it is down.', [
                        'server' => $oldPrimary->name,
                        'error' => $e->getMessage(),
                    ]));
                }

                $fenced = false;
                ServerLog::log($oldPrimary, 'postgres-fence-failed', $e->getMessage());
            }

            $state = $this->checkpoint($cluster, 'fenced', ['fenced' => $fenced]);
        }

        if ($state['step'] === 'fenced') {
            DatabaseReplica::query()->findOrFail($state['replica_id'])->replication()->promote();
            $state = $this->checkpoint($cluster, 'promoted');
        }

        if ($state['step'] === 'promoted') {
            DB::transaction(fn () => $this->swap($cluster, $state, $newPrimary, $oldPrimary));
            $state = $this->checkpoint($cluster->refresh(), 'swapped');
        }

        if ($state['step'] === 'swapped') {
            $this->rewire($cluster->refresh(), $newPrimary);
            $this->checkpoint($cluster, 'rewired');
        }

        $cluster->update(['status' => PostgresClusterStatus::ACTIVE, 'failover' => null]);
        app(ManagePgBackRest::class)->queue($cluster->backup->refresh(), 'full');

        $this->broadcast($cluster);
    }

    public function failed(PostgresCluster $cluster, Throwable $e): void
    {
        $cluster->refresh();
        $state = $cluster->failover;

        if ($state === null) {
            return;
        }

        $candidate = DatabaseReplica::query()->find($state['replica_id']);

        if ($e instanceof PostgresFailoverAborted) {
            $cluster->update(['status' => PostgresClusterStatus::ACTIVE, 'failover' => null]);
            $candidate?->update(['status' => DatabaseReplicaStatus::READY, 'message' => $e->getMessage()]);
        } else {
            $cluster->update(['failover' => [...$state, 'error' => Str::limit($e->getMessage(), 1000)]]);
            $candidate?->update(['message' => __('Failover stopped at step ":step": :error. Fix the cause and continue the failover.', [
                'step' => $state['step'],
                'error' => Str::limit($e->getMessage(), 500),
            ])]);

            if ($candidate !== null) {
                Notifier::send($candidate->replica, new DatabaseReplicaFailed($candidate));
            }
        }

        $this->broadcast($cluster);
    }

    /**
     * @param  array<string, mixed>  $state
     */
    private function swap(PostgresCluster $cluster, array $state, Server $newPrimary, Server $oldPrimary): void
    {
        if ($cluster->primary_server_id === $newPrimary->id) {
            return;
        }

        $backup = $cluster->backup;
        $backup->update([
            'server_id' => $newPrimary->id,
            'configuration' => [...$backup->configuration, 'pg_path' => $state['new_pg_path'], 'pg_port' => $state['new_pg_port']],
        ]);

        $cluster->update(['primary_server_id' => $newPrimary->id]);

        $cluster->replicas()->firstOrCreate(['replica_server_id' => $oldPrimary->id], [
            'status' => DatabaseReplicaStatus::NEEDS_REBUILD,
            'health' => DatabaseReplicaHealth::UNKNOWN,
            ...app(ManageDatabaseReplica::class)->credentials(),
            'max_slot_wal_keep_size_gb' => $state['max_slot_wal_keep_size_gb'],
            'message' => $state['fenced']
                ? __('This server was the primary before :server was promoted. Rebuild it to add it back as a replica.', ['server' => $newPrimary->name])
                : __('Vito could not reach this server during failover, so it was not stopped. Make sure PostgreSQL is not running here, then rebuild it as a replica.'),
            'configuration' => [
                'replica' => ['data_directory' => $state['old_pg_path'], 'port' => $state['old_pg_port'], 'version_num' => (int) $oldPrimary->database()?->version * 10000],
                'rebuild' => true,
                'fenced' => $state['fenced'],
            ],
        ]);

        DatabaseReplica::query()->whereKey($state['replica_id'])->first()?->delete();
    }

    private function rewire(PostgresCluster $cluster, Server $newPrimary): void
    {
        app(SyncPostgresClusterHosts::class)->sync($cluster);
        app(SyncPostgresClusterFirewall::class)->sync($cluster);

        $cluster->replicas()
            ->whereIn('status', [DatabaseReplicaStatus::READY, DatabaseReplicaStatus::FAILED, DatabaseReplicaStatus::SEEDING])
            ->get()
            ->each(function (DatabaseReplica $replica) use ($newPrimary): void {
                $replica->update(['configuration' => [...$replica->configuration, 'primary' => $replica->replication()->configurePrimary()]]);
                $replica->replication()->repoint();
                $replica->update(['message' => __('Re-pointed to the new primary :server.', ['server' => $newPrimary->name])]);
                dispatch(new CheckDatabaseReplicaJob($replica))->onQueue('ssh')->delay(now()->addMinutes(2));
            });

        $newPrimary->ssh()->exec(
            'sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -c '.escapeshellarg($this->dropUnusedRolesSql($cluster)),
            'postgres-drop-unused-replication-roles'
        );

        app(ManageDatabaseReplica::class)->syncBackupServer($cluster);
        $cluster->backup->refresh()->pgBackRest()->enableArchiving();
    }

    private function dropUnusedRolesSql(PostgresCluster $cluster): string
    {
        $keep = $cluster->replicas()->pluck('username')->map(fn (string $name): string => "'".str_replace("'", "''", $name)."'")->push("''")->implode(', ');

        return "DO \$\$ DECLARE r record; BEGIN FOR r IN SELECT rolname FROM pg_roles WHERE rolname LIKE 'vito\\_replica\\_%' AND rolname NOT IN ({$keep}) LOOP EXECUTE format('DROP ROLE %I', r.rolname); END LOOP; END \$\$;";
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private function checkpoint(PostgresCluster $cluster, string $step, array $values = []): array
    {
        $cluster->update(['failover' => [...$cluster->failover, ...$values, 'step' => $step]]);

        return $cluster->failover;
    }

    private function broadcast(PostgresCluster $cluster): void
    {
        $cluster->refresh()->load('primary', 'network', 'backup.storage');

        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $cluster->project_id,
            type: 'database-replica.cluster-updated',
            data: new PostgresClusterResource($cluster),
        ));

        $cluster->replicas()->get()->each(fn (DatabaseReplica $replica) => app(BroadcastDatabaseReplicaUpdate::class)->broadcast($replica));
    }
}
