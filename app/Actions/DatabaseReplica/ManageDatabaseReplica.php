<?php

namespace App\Actions\DatabaseReplica;

use App\Actions\Backup\ManagePgBackRest;
use App\Actions\Network\RemoveServerFromNetwork;
use App\Actions\PostgresCluster\IssueClusterCertificates;
use App\Actions\PostgresCluster\PreparePostgresClusterNetwork;
use App\Actions\PostgresCluster\SyncPostgresClusterFirewall;
use App\Actions\PostgresCluster\SyncPostgresClusterHosts;
use App\Actions\PostgresCluster\SyncPostgresListenAddresses;
use App\DTOs\SocketEventDTO;
use App\Enums\BackupFileStatus;
use App\Enums\BackupStatus;
use App\Enums\DatabaseReplicaHealth;
use App\Enums\DatabaseReplicaStatus;
use App\Enums\PostgresClusterStatus;
use App\Events\SocketEvent;
use App\Exceptions\SSHError;
use App\Facades\Notifier;
use App\Jobs\DatabaseReplica\CheckDatabaseReplicaJob;
use App\Jobs\DatabaseReplica\DetachDatabaseReplicaJob;
use App\Jobs\DatabaseReplica\MonitorDatabaseReplicaSeedJob;
use App\Jobs\DatabaseReplica\SetupDatabaseReplicaJob;
use App\Models\DatabaseReplica;
use App\Models\PostgresCluster;
use App\Models\Server;
use App\Models\ServerLog;
use App\Notifications\DatabaseReplicaFailed;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class ManageDatabaseReplica
{
    public function create(Server $primary, array $input): DatabaseReplica
    {
        $replicaServer = $this->validate($primary, $input);
        $cluster = PostgresCluster::forServer($primary);

        if ($cluster?->backup === null) {
            app(ManagePgBackRest::class)->create($primary, $input['backup'] ?? []);
            $cluster = PostgresCluster::forServer($primary);
        }

        $replica = $cluster->replicas()->create([
            'replica_server_id' => $replicaServer->id,
            'status' => DatabaseReplicaStatus::PENDING,
            'health' => DatabaseReplicaHealth::UNKNOWN,
            ...$this->credentials(),
            'max_slot_wal_keep_size_gb' => (int) $input['max_slot_wal_keep_size_gb'],
        ]);

        $this->queueSetup($replica);

        return $replica;
    }

    public function backupAvailable(?PostgresCluster $cluster): void
    {
        $cluster?->replicas()
            ->where('status', DatabaseReplicaStatus::WAITING_FOR_BACKUP)
            ->each(fn (DatabaseReplica $replica) => $this->queueSetup($replica));
    }

    public function resync(DatabaseReplica $replica): void
    {
        if ($replica->cluster->status !== PostgresClusterStatus::ACTIVE) {
            throw ValidationException::withMessages([
                'replica' => __('The cluster is failing over. Finish or continue the failover before rebuilding replicas.'),
            ]);
        }

        if (! in_array($replica->status, [DatabaseReplicaStatus::READY, DatabaseReplicaStatus::FAILED, DatabaseReplicaStatus::NEEDS_REBUILD], true)) {
            throw ValidationException::withMessages([
                'replica' => __('Only a ready, failed or fenced replica can be rebuilt.'),
            ]);
        }

        $replica->update(['progress' => null, 'message' => null, 'health' => DatabaseReplicaHealth::UNKNOWN, 'health_reasons' => null]);
        $this->queueSetup($replica);
    }

    public function setup(DatabaseReplica $replica): bool
    {
        $cluster = $replica->cluster;
        $rebuild = ($replica->configuration['rebuild'] ?? false) === true;

        $replica->update(['status' => DatabaseReplicaStatus::CONFIGURING]);
        app(BroadcastDatabaseReplicaUpdate::class)->broadcast($replica);

        $this->step($replica, 'connecting both servers to the private network');
        if (! app(PreparePostgresClusterNetwork::class)->prepare($cluster, $replica->replica)) {
            return false;
        }

        $replication = $replica->replication();
        $this->step($replica, 'reading the PostgreSQL settings of the replica');
        $replica->update(['configuration' => [...($replica->configuration ?? []), 'replica' => $replication->inspectReplica()]]);

        $this->step($replica, 'writing the cluster host names');
        app(SyncPostgresClusterHosts::class)->sync($cluster);

        $this->step($replica, 'making PostgreSQL on the primary listen on its private address');
        if (! app(SyncPostgresListenAddresses::class)->ensure($cluster->primary)) {
            return false;
        }

        $this->step($replica, 'opening the firewall on the primary for the replica');
        if (! app(SyncPostgresClusterFirewall::class)->sync($cluster)) {
            return false;
        }

        $this->step($replica, 'creating the replication user, slot and pg_hba.conf rule on the primary');
        $replica->update(['configuration' => [...$replica->configuration, 'primary' => $replication->configurePrimary()]]);

        $this->step($replica, 'setting up pgBackRest certificates, configs and the TLS server');
        $this->syncBackupServer($cluster);

        $this->step($replica, 'starting the restore on the replica');
        $replication->startSeed($rebuild);
        $this->step($replica, 'restoring the latest backup on the replica');

        $replica->update([
            'status' => DatabaseReplicaStatus::SEEDING,
            'progress' => null,
            'configuration' => [...$replica->configuration, 'rebuild' => false],
        ]);
        app(BroadcastDatabaseReplicaUpdate::class)->broadcast($replica);

        dispatch(new MonitorDatabaseReplicaSeedJob($replica))->onQueue('ssh')->delay(now()->addSeconds(30));

        return true;
    }

    public function syncBackupServer(PostgresCluster $cluster): void
    {
        app(IssueClusterCertificates::class)->ensure($cluster);
        $cluster->refresh();

        $pgBackRest = $cluster->backup->pgBackRest();

        foreach ($cluster->nodes() as $node) {
            if ($node->id === $cluster->primary_server_id || $cluster->replicas()->where('replica_server_id', $node->id)->whereNotIn('status', [DatabaseReplicaStatus::NEEDS_REBUILD])->exists()) {
                $pgBackRest->writeTls($node);
            }
        }

        $pgBackRest->writeConfigs();

        if ($cluster->streamingReplicas()->isEmpty()) {
            $pgBackRest->removeServer($cluster->primary);
            $tls = $cluster->tls;
            unset($tls['server_installed_at']);
            $cluster->update(['tls' => $tls]);

            return;
        }

        $pgBackRest->installServer();

        $cluster->update(['tls' => [...$cluster->tls, 'server_installed_at' => now()->toIso8601String()]]);
    }

    public function seedOutput(DatabaseReplica $replica): string
    {
        try {
            $output = $replica->replication()->seedOutput();
        } catch (SSHError $e) {
            return __('Vito could not read the restore output from :server: :error', ['server' => $replica->replica->name, 'error' => $e->getMessage()]);
        }

        return $output !== '' && ! str_contains($output, '-- No entries --')
            ? $output
            : __('The restore on :server has not written any output yet.', ['server' => $replica->replica->name]);
    }

    public function monitorSeed(DatabaseReplica $replica): bool
    {
        $unit = $replica->replication()->seedUnit();
        $state = $unit->state();

        if ($state === 'running') {
            $replica->touch();
            app(BroadcastDatabaseReplicaUpdate::class)->broadcast($replica);

            return false;
        }

        if ($state !== 'succeeded') {
            $reason = $state === 'failed' ? $unit->failureReason() : '';
            $unit->cleanup();
            $this->fail($replica, $reason !== '' ? $reason : __('The seed process on the replica stopped before it finished, for example because the server restarted.'));

            return true;
        }

        $unit->cleanup();
        $replica->update([
            'status' => DatabaseReplicaStatus::READY,
            'progress' => null,
            'message' => null,
        ]);
        app(BroadcastDatabaseReplicaUpdate::class)->broadcast($replica);

        dispatch(new CheckDatabaseReplicaJob($replica))->onQueue('ssh');

        return true;
    }

    public function delete(DatabaseReplica $replica): void
    {
        if ($replica->status->isBusy() || $replica->cluster->status !== PostgresClusterStatus::ACTIVE) {
            throw ValidationException::withMessages([
                'replica' => __('Wait for the current operation on this cluster to finish.'),
            ]);
        }

        $replica->update(['status' => DatabaseReplicaStatus::DELETING]);
        app(BroadcastDatabaseReplicaUpdate::class)->broadcast($replica);

        dispatch(new DetachDatabaseReplicaJob($replica))->onQueue('ssh');
    }

    public function runDelete(DatabaseReplica $replica): void
    {
        $cluster = $replica->cluster;
        $replication = $replica->replication();

        try {
            $replication->detachReplica();
        } catch (SSHError $e) {
            if (! ($replica->configuration['detach_unreachable'] ?? false)) {
                $replica->update(['configuration' => [...($replica->configuration ?? []), 'detach_unreachable' => true]]);

                throw new RuntimeException(__('Vito could not reach :server to stop replication and archiving there: :error. If the server is gone for good, delete the replica again to remove it anyway, and make sure it never starts PostgreSQL with this configuration.', [
                    'server' => $replica->replica->name,
                    'error' => $e->getMessage(),
                ]));
            }

            ServerLog::log($replica->replica, 'database-replica-detach-failed', __('The replica was removed without reaching the server: :error', ['error' => $e->getMessage()]));
        }

        try {
            $replication->teardownPrimary();
        } catch (Throwable $e) {
            ServerLog::log($cluster->primary, 'database-replica-teardown-failed', __('Remove the replication slot :slot and role :role on this server: :error', [
                'slot' => $replica->slot_name,
                'role' => $replica->username,
                'error' => $e->getMessage(),
            ]));
        }

        $member = $cluster->owns_network ? $cluster->network?->servers()->where('server_id', $replica->replica_server_id)->first() : null;
        $projectId = $cluster->primary->project_id;
        $replica->delete();

        app(SyncPostgresClusterFirewall::class)->sync($cluster);

        if ($cluster->backup?->status === null && isset($cluster->tls['server_installed_at'])) {
            $this->syncBackupServer($cluster->refresh());
        }

        if ($member !== null) {
            app(RemoveServerFromNetwork::class)->remove($member);
        }

        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $projectId,
            type: 'database-replica.deleted',
            data: ['id' => $replica->id],
        ));
    }

    private function step(DatabaseReplica $replica, string $step): void
    {
        $replica->update(['configuration' => [...($replica->configuration ?? []), 'setup_step' => $step]]);
    }

    public function fail(DatabaseReplica $replica, string $message): void
    {
        $replica->update([
            'status' => DatabaseReplicaStatus::FAILED,
            'progress' => null,
            'message' => Str::limit($message, 1000),
        ]);

        app(BroadcastDatabaseReplicaUpdate::class)->broadcast($replica);
        Notifier::send($replica->primary, new DatabaseReplicaFailed($replica));
    }

    /**
     * @return array{slot_name: string, username: string, password: string}
     */
    public function credentials(): array
    {
        $suffix = Str::lower(Str::random(10));

        return [
            'slot_name' => 'vito_replica_'.$suffix,
            'username' => 'vito_replica_'.$suffix,
            'password' => Str::password(40, symbols: false),
        ];
    }

    private function queueSetup(DatabaseReplica $replica): void
    {
        $backup = $replica->cluster->backup;
        $ready = $backup?->status === null && $backup->files()->where('status', BackupFileStatus::CREATED)->exists();

        $replica->update(['status' => $ready ? DatabaseReplicaStatus::PENDING : DatabaseReplicaStatus::WAITING_FOR_BACKUP]);
        app(BroadcastDatabaseReplicaUpdate::class)->broadcast($replica);

        if ($ready) {
            dispatch(new SetupDatabaseReplicaJob($replica))->onQueue('ssh');
        }
    }

    private function validate(Server $primary, array $input): Server
    {
        Validator::make($input, [
            'replica_server_id' => ['required', 'integer', Rule::exists('servers', 'id')->where('project_id', $primary->project_id)],
            'max_slot_wal_keep_size_gb' => ['required', 'integer', 'min:1', 'max:10000'],
        ])->validate();

        $replicaServer = Server::query()->findOrFail((int) $input['replica_server_id']);
        $cluster = PostgresCluster::forServer($primary);
        $error = match (true) {
            $replicaServer->id === $primary->id => __('A server cannot replicate itself.'),
            ! $replicaServer->isReady() => __('The replica server is not ready.'),
            $primary->database()?->name !== 'postgresql' => __('Replicas need a PostgreSQL service on the primary server.'),
            $replicaServer->database()?->name !== 'postgresql' => __('Install PostgreSQL on the replica server first.'),
            (int) $replicaServer->database()->version !== (int) $primary->database()->version => __('The replica must run the same PostgreSQL major version as the primary (:version).', ['version' => $primary->database()->version]),
            $cluster !== null && $cluster->primary_server_id !== $primary->id => __('This server is a replica. Create replicas from the primary of its cluster.'),
            $cluster !== null && $cluster->status !== PostgresClusterStatus::ACTIVE => __('The cluster is failing over, try again when it finishes.'),
            PostgresCluster::forServer($replicaServer) !== null => __('The selected server already belongs to a PostgreSQL cluster.'),
            $replicaServer->databases()->exists() || $replicaServer->backups()->exists() => __('The replica server must not have databases or backups, because all of its PostgreSQL data is replaced.'),
            $cluster?->backup?->status === BackupStatus::FAILED => __('The pgBackRest backup of this server failed to set up. Fix it before adding replicas.'),
            default => null,
        };

        if ($error !== null) {
            throw ValidationException::withMessages(['replica_server_id' => $error]);
        }

        return $replicaServer;
    }
}
