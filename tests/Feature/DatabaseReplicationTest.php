<?php

use App\Actions\Backup\ManageBackup;
use App\Actions\Backup\ManagePgBackRest;
use App\Actions\Backup\RunBackup;
use App\Actions\Backup\SelectPgBackRestHost;
use App\Actions\DatabaseReplica\CheckDatabaseReplicaHealth;
use App\Actions\DatabaseReplica\GetDatabaseReplicaMetrics;
use App\Actions\DatabaseReplica\ManageDatabaseReplica;
use App\Actions\PostgresCluster\PromoteReplica;
use App\Enums\BackupFileStatus;
use App\Enums\DatabaseReplicaHealth;
use App\Enums\DatabaseReplicaStatus;
use App\Enums\FirewallRuleStatus;
use App\Enums\NetworkServerStatus;
use App\Enums\PostgresClusterStatus;
use App\Events\SocketEvent;
use App\Exceptions\SSHCommandError;
use App\Facades\SSH as SSHFacade;
use App\Helpers\SSH;
use App\Jobs\Backup\RunJob;
use App\Jobs\DatabaseReplica\CheckDatabaseReplicaJob;
use App\Jobs\DatabaseReplica\DetachDatabaseReplicaJob;
use App\Jobs\DatabaseReplica\MonitorDatabaseReplicaSeedJob;
use App\Jobs\DatabaseReplica\SetupDatabaseReplicaJob;
use App\Jobs\PostgresCluster\PromoteReplicaJob;
use App\Jobs\Service\ToggleNetworkingJob;
use App\Models\BackupFile;
use App\Models\Database;
use App\Models\DatabaseReplica;
use App\Models\DatabaseReplicaMetric;
use App\Models\FirewallRule;
use App\Models\Network;
use App\Models\PostgresCluster;
use App\Models\Project;
use App\Models\Server;
use App\Models\Service;
use App\Models\StorageProvider;
use App\Notifications\DatabaseReplicaHealthChanged;
use App\Notifications\NotificationInterface;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Validation\ValidationException;
use phpseclib3\File\X509;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
set_exception_handler(function (Throwable $error): void {
    fwrite(STDERR, $error->getMessage()."\n".$error->getTraceAsString()."\n");
    exit(1);
});
config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:', 'cache.default' => 'array']);
DB::purge('sqlite');
if (DB::connection()->getConfig('database') !== ':memory:') {
    fwrite(STDERR, "Refusing to run outside an in-memory database.\n");
    exit(1);
}
Artisan::call('migrate', ['--force' => true]);
Queue::fake();
Event::fake([SocketEvent::class]);

function expectReplication(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

function expectReplicationValidation(Closure $callback, string $message): void
{
    try {
        $callback();
    } catch (ValidationException) {
        return;
    }

    throw new RuntimeException($message);
}

$ssh = new class extends SSH
{
    public array $commands = [];

    public array $writes = [];

    public array $responses = [];

    public array $failures = [];

    public function init(Server $server, ?string $asUser = null): self
    {
        $this->server = $server;

        return $this;
    }

    public function exec(string|View $command, string $log = '', ?int $siteId = null, ?bool $stream = false, ?callable $streamCallback = null, int $timeout = 0): string
    {
        $command = (string) $command;
        $this->commands[] = ['server' => $this->server->name, 'command' => $command];

        foreach ($this->failures as $failure) {
            [$server, $needle] = explode(':', $failure, 2);
            if (($server === '*' || $server === $this->server->name) && str_contains($command, $needle)) {
                throw new SSHCommandError('fake failure');
            }
        }

        foreach ($this->responses as $needle => $response) {
            if (str_contains($command, $needle)) {
                return $response;
            }
        }

        return '';
    }

    public function write(string $remotePath, string|View $content, ?string $owner = null, ?string $log = null, ?int $siteId = null): void
    {
        $this->writes[$this->server->name.':'.$remotePath] = ['content' => (string) $content, 'owner' => $owner];
    }

    public function ran(string $server, string $needle): ?string
    {
        return collect($this->commands)->last(fn (array $command): bool => $command['server'] === $server && str_contains($command['command'], $needle))['command'] ?? null;
    }
};
SSHFacade::swap($ssh);

$notifier = new class
{
    public array $sent = [];

    public function send(object $notifiable, NotificationInterface $notification): void
    {
        $this->sent[] = $notification;
    }
};
$app->instance('notifier', $notifier);

Project::query()->forceCreate(['id' => 1, 'name' => 'Production']);
$makeServer = function (string $name, string $ip, string $version = '17', bool $firewall = true): Server {
    $server = Server::withoutEvents(fn () => Server::query()->create([
        'project_id' => 1, 'user_id' => 1, 'name' => $name, 'ip' => $ip, 'os' => 'ubuntu_24', 'provider' => 'custom', 'status' => 'ready',
    ]));
    Service::query()->create(['server_id' => $server->id, 'type' => 'database', 'name' => 'postgresql', 'version' => $version, 'status' => 'ready', 'is_default' => true, 'type_data' => ['networking' => false]]);
    if ($firewall) {
        Service::query()->create(['server_id' => $server->id, 'type' => 'firewall', 'name' => 'ufw', 'version' => 'latest', 'status' => 'ready', 'is_default' => true]);
    }

    return $server;
};
$primary = $makeServer('pg-primary', '203.0.113.10');
$standby = $makeServer('pg-standby', '203.0.113.11');
$second = $makeServer('pg-second', '203.0.113.13');
$old = $makeServer('pg-old', '203.0.113.12', '16');
$bare = $makeServer('pg-bare', '203.0.113.14', '17', false);
$storage = StorageProvider::withoutEvents(fn () => StorageProvider::query()->create([
    'user_id' => 1, 'profile' => 'Backups', 'provider' => 's3',
    'credentials' => ['api_url' => 'https://fsn1.your-objectstorage.com', 'key' => 'access', 'secret' => 'secret', 'region' => 'eu-central', 'bucket' => 'db', 'path' => ''],
]));
$replicas = app(ManageDatabaseReplica::class);
$backupInput = ['storage' => $storage->id, 'strategy' => 'standard', 'process_max' => '4', 'wal_queue_max_gb' => '10'];
$input = ['replica_server_id' => $standby->id, 'max_slot_wal_keep_size_gb' => '64', 'backup' => $backupInput];

expectReplicationValidation(fn () => $replicas->create($primary, [...$input, 'replica_server_id' => $primary->id]), 'A server must not replicate itself.');
expectReplicationValidation(fn () => $replicas->create($primary, [...$input, 'replica_server_id' => $old->id]), 'Replicas must run the same major version.');
$userDatabase = Database::query()->create(['server_id' => $standby->id, 'name' => 'app', 'status' => 'ready']);
expectReplicationValidation(fn () => $replicas->create($primary, $input), 'A replica server with databases must be refused.');
$userDatabase->delete();
expectReplicationValidation(fn () => $replicas->create($primary, [...$input, 'backup' => []]), 'A primary without backups must get a backup strategy with the replica.');

$replica = $replicas->create($primary, $input);
$cluster = PostgresCluster::forServer($primary);
$backup = $cluster->backup;
expectReplication($backup !== null && $backup->configuration['strategy'] === 'standard', 'Creating the first replica must create the backup strategy.');
expectReplication($replica->fresh()->status === DatabaseReplicaStatus::WAITING_FOR_BACKUP && Queue::pushed(SetupDatabaseReplicaJob::class)->isEmpty(), 'A replica must wait for the first full backup.');
expectReplication(! str_contains((string) DB::table('database_replicas')->value('password'), $replica->password), 'The replication password must be stored encrypted.');
expectReplicationValidation(fn () => $replicas->create($primary, $input), 'A server already in a cluster must be refused.');

$backup->update(['status' => null, 'configuration' => [...$backup->configuration, 'pg_path' => '/var/lib/postgresql/17/main', 'pg_port' => 5432]]);
BackupFile::withoutEvents(fn () => BackupFile::query()->create(['backup_id' => $backup->id, 'name' => '20260917-020000F', 'status' => BackupFileStatus::CREATED, 'type' => 'full']));
Queue::fake();
$replicas->backupAvailable($cluster);
expectReplication($replica->fresh()->status === DatabaseReplicaStatus::PENDING && Queue::pushed(SetupDatabaseReplicaJob::class)->count() === 1, 'The first finished backup must start waiting replicas.');

Queue::fake();
expectReplication($replicas->setup($replica->fresh()) === false, 'Setup must wait for the private network.');
$network = Network::query()->find($cluster->fresh()->network_id);
expectReplication($network?->type->value === 'wireguard' && $cluster->fresh()->owns_network, 'Servers without a shared network must get a WireGuard network.');
expectReplication($network->firewallRules()->where('name', 'Allow all')->doesntExist(), 'The replication network must not allow all traffic between members.');
$network->servers()->update(['status' => NetworkServerStatus::ACTIVE]);
$address = fn (Server $server): string => $network->servers()->where('server_id', $server->id)->value('ip');

$ssh->responses['SHOW data_directory'] = "VITO_DATA_DIRECTORY=/var/lib/postgresql/17/main\nVITO_PORT=5432\nVITO_VERSION_NUM=170005\n";
$ssh->responses['SHOW listen_addresses'] = 'localhost';
Queue::fake();
expectReplication($replicas->setup($replica->fresh()) === false, 'Setup must wait while the primary does not listen on its private address.');
expectReplication(Queue::pushed(ToggleNetworkingJob::class)->count() === 1 && $primary->database()->status->value === 'restarting', 'Setup must restart PostgreSQL on the primary with the private listen address.');
$hosts = $ssh->ran('pg-standby', 'BEGIN VITO POSTGRES');
expectReplication($hosts !== null && str_contains($hosts, "'".$address($primary)."' 'vito-pg-{$primary->id}'") && str_contains($hosts, 'ip_nonlocal_bind'), 'Every node must resolve the cluster aliases.');
expectReplication($primary->database()->handler()->listenAddresses(false) === 'localhost,'.$address($primary), 'PostgreSQL must listen on localhost and the private address only.');

$primary->database()->update(['status' => 'ready']);
$ssh->responses['SHOW listen_addresses'] = 'localhost,'.$address($primary);
Queue::fake();
expectReplication($replicas->setup($replica->fresh()) === false, 'Setup must wait for the firewall rules.');
$rules = FirewallRule::query()->where('note', 'like', "vito-pg:{$cluster->id}:%")->get();
expectReplication($rules->count() === 2 && $rules->every(fn ($rule) => $rule->server_id === $primary->id && $rule->source === $address($standby) && (int) $rule->mask === 32)
    && $rules->pluck('port')->sort()->values()->all() === ['5432', '8432'], 'Only the replica address may reach PostgreSQL and the pgBackRest TLS server on the primary.');
FirewallRule::query()->whereIn('id', $rules->pluck('id'))->update(['status' => FirewallRuleStatus::READY]);

$ssh->responses['max_replication_slots'] = "VITO_PORT=5432\nVITO_SSL=on\nVITO_SETTING max_connections=500\n";
$ssh->commands = [];
Queue::fake();
expectReplication($replicas->setup($replica->fresh()) === true, 'Setup must seed once the network and firewall are ready.');
$replica->refresh();
$cluster->refresh();
$configure = $ssh->ran('pg-primary', 'max_replication_slots');
expectReplication(str_contains($configure, "'{$replica->username}' '".$address($standby)."/32'") && ! str_contains($configure, $replica->password), 'pg_hba.conf must allow replication from the private address only, without logging the password.');
$seed = $ssh->ran('pg-standby', 'systemd-run');
foreach ([
    "--stanza='{$cluster->stanza}' --type=standby restore", "host=vito-pg-{$primary->id}", 'sslmode=require', "primary_slot_name = '{$replica->slot_name}'",
    "listen_addresses = '%s'", 'localhost,'.$address($standby), 'archive_mode = on', 'max_connections = 500',
] as $needle) {
    expectReplication(str_contains($seed, $needle), "The seed script must contain {$needle}.");
}
expectReplication(! str_contains($seed, 'pg_basebackup') && ! str_contains($seed, '--delta') && ! str_contains($seed, $replica->password), 'A new replica must be restored from the backup without a password in the script.');
$primaryConfig = $ssh->writes['pg-primary:/etc/pgbackrest/pgbackrest.conf']['content'];
$replicaConfig = $ssh->writes['pg-standby:/etc/pgbackrest/pgbackrest.conf']['content'];
expectReplication(str_contains($primaryConfig, 'tls-server-address='.$address($primary)) && str_contains($primaryConfig, "tls-server-auth=vito-pg-{$standby->id}={$cluster->stanza}"), 'The primary must run a TLS server that only accepts the replica certificate.');
expectReplication(str_contains($replicaConfig, 'pg1-path=/var/lib/postgresql/17/main') && str_contains($replicaConfig, "pg2-host=vito-pg-{$primary->id}") && str_contains($replicaConfig, 'pg2-host-type=tls') && ! str_contains($replicaConfig, 'tls-server-address'), 'The replica must reach the primary over TLS for backups from standby.');
expectReplication($ssh->ran('pg-primary', 'vito-pgbackrest-server') !== null && isset($cluster->tls['server_installed_at']), 'The pgBackRest TLS server must be installed on the primary.');
foreach ([$primary, $standby] as $node) {
    $cert = new X509;
    $cert->loadCA($cluster->tls['ca_cert']);
    $certificate = $cert->loadX509($ssh->writes[$node->name.':/etc/pgbackrest/tls/node.crt']['content']);
    expectReplication($certificate !== false && $cert->validateSignature() && in_array('vito-pg-'.$node->id, $cert->getDNProp('id-at-commonName'), true), "The certificate of {$node->name} must be signed by the cluster CA.");
    expectReplication($ssh->writes[$node->name.':/etc/pgbackrest/tls/node.key']['owner'] === 'postgres', 'TLS keys must belong to postgres.');
}
expectReplication(! str_contains((string) DB::table('postgres_clusters')->value('tls'), 'PRIVATE KEY'), 'TLS keys must be stored encrypted.');
foreach ([['pg-standby', '/etc/pgbackrest/pgbackrest.conf', '640'], ['pg-standby', '/etc/pgbackrest/tls/node.key', '600'], ['pg-standby', "/var/lib/postgresql/.vito-replica-{$replica->id}.pgpass", '600'], ['pg-primary', "/var/lib/postgresql/vito-replica-{$replica->id}.sql", '600']] as [$node, $path, $mode]) {
    expectReplication($ssh->ran($node, "sudo install -m {$mode} -o postgres -g postgres /dev/null '{$path}'") !== null, "{$path} must be created as postgres with mode {$mode} before secrets are written into it.");
}
expectReplication($ssh->ran('pg-standby', 'sudo install -d -m 755 /etc/pgbackrest') !== null, 'The pgBackRest directory must exist on a fresh replica before its config is written.');
expectReplication($replica->status === DatabaseReplicaStatus::SEEDING && Queue::pushed(MonitorDatabaseReplicaSeedJob::class)->count() === 1, 'Seeding must be monitored.');

$ssh->commands = [];
(new SetupDatabaseReplicaJob($replica->fresh()))->failed(new SSHCommandError('SSH command failed with an error'));
expectReplication(str_contains($replica->fresh()->message, 'Setup failed while restoring the latest backup on the replica') && $replica->fresh()->status === DatabaseReplicaStatus::FAILED, 'A failed setup must say which step failed.');
expectReplication(str_contains((string) $ssh->ran('pg-primary', 'pg_drop_replication_slot'), $replica->slot_name), 'A failed setup must drop its inactive slot so the primary does not keep WAL for it.');
$replica->update(['status' => DatabaseReplicaStatus::SEEDING, 'message' => null]);

$ssh->responses['systemctl show'] = "LoadState=loaded\nActiveState=active\nSubState=exited\nResult=success\n";
Queue::fake();
expectReplication($replicas->monitorSeed($replica->fresh()) === true && $replica->fresh()->status === DatabaseReplicaStatus::READY, 'A finished restore must make the replica ready.');

$ssh->responses['VITO_PRIMARY'] = "VITO_PRIMARY|t|reserved|1048576|65536|streaming|2048|1.5|2.5|3.5\n";
$ssh->responses['VITO_REPLICA'] = "VITO_REPLICA|t|streaming|0|9000\n";
$health = app(CheckDatabaseReplicaHealth::class);
$metric = $health->check($replica->fresh());
expectReplication($replica->fresh()->health === DatabaseReplicaHealth::HEALTHY && $metric->lag_bytes === 2048 && $metric->replay_lag_ms === 3.5 && $metric->replay_delay_seconds === 0.0, 'A streaming replica must be healthy with its lag and latency recorded.');

expectReplication(app(SelectPgBackRestHost::class)->select($cluster->fresh())->is($standby), 'Backups must run on a healthy replica.');
Queue::fake();
$ssh->commands = [];
$file = app(RunBackup::class)->run($backup->fresh(), 'incr');
app(ManagePgBackRest::class)->run($file->fresh());
expectReplication($ssh->ran('pg-standby', "--type='incr' --backup-standby=y backup") !== null && $file->fresh()->server_id === $standby->id, 'A backup must be taken from the replica straight to S3.');
BackupFile::query()->whereKey($file->id)->update(['status' => BackupFileStatus::FAILED]);

$ssh->responses['VITO_PRIMARY'] = "VITO_PRIMARY|t|extended|1048576|65536|streaming|3221225472|10|20|45000\n";
$notifier->sent = [];
$health->check($replica->fresh());
expectReplication($replica->fresh()->health === DatabaseReplicaHealth::CRITICAL && count($replica->fresh()->health_reasons) === 3, 'Byte lag, replay latency and WAL status must all be reported.');
expectReplication(collect($notifier->sent)->contains(fn ($n) => $n instanceof DatabaseReplicaHealthChanged), 'Becoming critical must notify.');
expectReplication(app(SelectPgBackRestHost::class)->select($cluster->fresh())->is($primary), 'Backups must fall back to the primary when the replica is unhealthy.');

$ssh->responses['VITO_PRIMARY'] = "VITO_PRIMARY|f|reserved|5368709120|65536||||\n";
$ssh->responses['VITO_REPLICA'] = "VITO_REPLICA_DOWN\n";
$health->check($replica->fresh());
expectReplication(str_contains(implode(' ', $replica->fresh()->health_reasons), 'not connected'), 'A disconnected replica must explain why.');
$ssh->responses['VITO_PRIMARY'] = "VITO_PRIMARY|t|reserved|1048576|65536|streaming|0|||\n";
$ssh->responses['VITO_REPLICA'] = "VITO_REPLICA|t|streaming|0|\n";
$ssh->failures = ['pg-primary:VITO_PRIMARY'];
$health->check($replica->fresh());
expectReplication(str_contains(implode(' ', $replica->fresh()->health_reasons), 'could not reach the primary'), 'An unreachable primary must be critical.');
$ssh->failures = [];
$health->check($replica->fresh());

DatabaseReplicaMetric::query()->delete();
foreach (range(1, 500) as $minute) {
    DatabaseReplicaMetric::query()->create(['database_replica_id' => $replica->id, 'health' => 'healthy', 'lag_bytes' => $minute])
        ->forceFill(['created_at' => now()->subMinutes(501 - $minute)])->save();
}
$history = app(GetDatabaseReplicaMetrics::class)->get($replica, ['period' => '24h']);
expectReplication($history['metrics']->count() <= 240 && $history['metrics']->last()['lag_bytes'] === 500, 'History must be downsampled and keep the worst lag per bucket.');
DatabaseReplicaMetric::query()->first()->forceFill(['created_at' => now()->subDays(40)])->save();
Queue::fake();
Artisan::call('database-replicas:check');
expectReplication(Queue::pushed(CheckDatabaseReplicaJob::class)->count() === 1 && DatabaseReplicaMetric::query()->count() === 499, 'The check command must queue checks and prune old metrics.');

$network->servers()->create(['server_id' => $second->id, 'ip' => '100.64.0.9', 'public_key' => 'key', 'private_key' => 'key', 'status' => NetworkServerStatus::ACTIVE]);
$other = $cluster->replicas()->create([
    'replica_server_id' => $second->id, 'status' => DatabaseReplicaStatus::READY, 'health' => DatabaseReplicaHealth::HEALTHY, ...$replicas->credentials(), 'max_slot_wal_keep_size_gb' => 64,
    'configuration' => ['replica' => ['data_directory' => '/var/lib/postgresql/17/main', 'port' => 5432, 'version_num' => 170005], 'primary' => ['port' => 5432, 'ssl' => true, 'settings' => []]],
]);
expectReplicationValidation(fn () => app(PromoteReplica::class)->promote($replica->fresh(), ['confirmation' => 'pg-standby']), 'Failover must be refused while it is turned off.');
config(['database-replication.failover_enabled' => true]);
$replica->update(['health' => DatabaseReplicaHealth::CRITICAL]);
expectReplicationValidation(fn () => app(PromoteReplica::class)->promote($replica->fresh(), ['confirmation' => 'pg-standby']), 'Promoting a critical replica must need confirmation.');
$replica->update(['health' => DatabaseReplicaHealth::HEALTHY]);
expectReplicationValidation(fn () => app(PromoteReplica::class)->promote($replica->fresh(), ['confirmation' => 'wrong']), 'Failover must require typing the replica server name.');
$replica->update(['health' => DatabaseReplicaHealth::CRITICAL]);
$replica->update(['health' => DatabaseReplicaHealth::HEALTHY]);
Queue::fake();
app(PromoteReplica::class)->promote($replica->fresh(), ['confirmation' => 'pg-standby']);
expectReplication($cluster->fresh()->status === PostgresClusterStatus::FAILING_OVER && Queue::pushed(PromoteReplicaJob::class)->count() === 1, 'Promotion must be queued with the cluster failing over.');
expectReplicationValidation(fn () => $replicas->delete($other->fresh()), 'Replicas must not be removed during failover.');

$ssh->failures = ['pg-primary:Fencing the old primary'];
try {
    app(PromoteReplica::class)->run($cluster->fresh());
    throw new LogicException('An unreachable old primary must stop promotion without confirmation.');
} catch (App\Exceptions\PostgresFailoverAborted $e) {
    app(PromoteReplica::class)->failed($cluster->fresh(), $e);
}
expectReplication($cluster->fresh()->status === PostgresClusterStatus::ACTIVE && $cluster->fresh()->failover === null && $replica->fresh()->status === DatabaseReplicaStatus::READY
    && str_contains($replica->fresh()->message, 'could not reach the old primary'), 'A refused promotion must leave the cluster as it was and explain how to continue.');

Queue::fake();
app(PromoteReplica::class)->promote($replica->fresh(), ['confirmation' => 'pg-standby']);
$ssh->failures = ['pg-second:primary_conninfo'];
$ssh->commands = [];
try {
    app(PromoteReplica::class)->run($cluster->fresh());
    throw new LogicException('A failing re-point must stop the failover.');
} catch (SSHCommandError $e) {
    app(PromoteReplica::class)->failed($cluster->fresh(), $e);
}
expectReplication($ssh->ran('pg-primary', 'systemctl mask') !== null && $ssh->ran('pg-standby', 'pg_promote(true, 120)') !== null, 'Failover must fence the old primary and promote the replica.');
expectReplication($cluster->fresh()->status === PostgresClusterStatus::FAILING_OVER && $cluster->fresh()->failover['step'] === 'swapped' && $cluster->fresh()->failover['error'] !== null
    && $cluster->fresh()->primary_server_id === $standby->id, 'A failover that breaks after the swap must keep its checkpoint and error instead of pretending nothing happened.');
expectReplicationValidation(fn () => app(RunBackup::class)->run($backup->fresh()), 'Backups must not start while the cluster is failing over.');

$ssh->failures = [];
$ssh->commands = [];
Queue::fake();
app(PromoteReplica::class)->retry($cluster->fresh(), []);
expectReplication(Queue::pushed(PromoteReplicaJob::class)->count() === 1, 'Continuing a failover must queue it again.');
app(PromoteReplica::class)->run($cluster->fresh());
expectReplication($ssh->ran('pg-primary', 'systemctl mask') === null && $ssh->ran('pg-standby', 'pg_promote(true, 120)') === null, 'Continuing a failover must not fence or promote again.');
$cluster->refresh();
$fenced = $cluster->replicas()->where('replica_server_id', $primary->id)->first();
expectReplication($cluster->primary_server_id === $standby->id && $cluster->status === PostgresClusterStatus::ACTIVE && $backup->fresh()->server_id === $standby->id, 'The replica must become the primary and own the backups.');
expectReplication(DatabaseReplica::query()->find($replica->id) === null && $fenced?->status === DatabaseReplicaStatus::NEEDS_REBUILD, 'The old primary must wait to be rebuilt as a replica.');
$repoint = $ssh->ran('pg-second', 'primary_conninfo');
expectReplication($repoint !== null && str_contains($repoint, "host=vito-pg-{$standby->id}") && $ssh->ran('pg-standby', 'max_replication_slots') !== null, 'Other replicas must follow the new primary with new slots.');
expectReplication(str_contains($ssh->writes['pg-standby:/etc/pgbackrest/pgbackrest.conf']['content'], "tls-server-auth=vito-pg-{$second->id}=") && str_contains($ssh->writes['pg-second:/etc/pgbackrest/pgbackrest.conf']['content'], "pg2-host=vito-pg-{$standby->id}"), 'Backups from standby must follow the new primary.');
expectReplication($ssh->ran('pg-standby', 'stanza-create') !== null, 'WAL archiving must continue from the new primary.');
expectReplication(Queue::pushed(RunJob::class)->count() === 1 && BackupFile::query()->where('backup_id', $backup->id)->latest('id')->value('type') === 'full', 'A full backup must be taken after failover.');
$newRules = FirewallRule::query()->where('note', 'like', "vito-pg:{$cluster->id}:%")->where('status', '!=', FirewallRuleStatus::DELETING)->get();
expectReplication($newRules->isNotEmpty() && $newRules->every(fn ($rule) => $rule->server_id === $standby->id && $rule->source === '100.64.0.9'), 'The firewall must follow the new primary.');

$ssh->responses['VITO_FENCE='] = "VITO_FENCE=f\n";
$ssh->commands = [];
$notifier->sent = [];
$health->fenceOnSight($fenced->fresh());
expectReplication($ssh->ran('pg-primary', 'systemctl mask') !== null && $fenced->fresh()->health === DatabaseReplicaHealth::CRITICAL && $notifier->sent !== [], 'A former primary that comes back must be fenced again.');

$cluster->update(['status' => PostgresClusterStatus::FAILING_OVER]);
expectReplicationValidation(fn () => $replicas->resync($fenced->fresh()), 'Replicas must not be rebuilt while the cluster is failing over.');
$cluster->update(['status' => PostgresClusterStatus::ACTIVE]);
Queue::fake();
$replicas->resync($fenced->fresh());
expectReplication($fenced->fresh()->status === DatabaseReplicaStatus::PENDING, 'The old primary must be rebuildable.');
$ssh->responses['SHOW listen_addresses'] = 'localhost,'.$address($standby);
FirewallRule::query()->where('status', FirewallRuleStatus::DELETING)->delete();
$ssh->commands = [];
$replicas->setup($fenced->fresh());
FirewallRule::query()->where('note', 'like', "vito-pg:{$cluster->id}:%")->update(['status' => FirewallRuleStatus::READY]);
$replicas->setup($fenced->fresh());
$rebuild = $ssh->ran('pg-primary', 'systemd-run');
expectReplication($rebuild !== null && str_contains($rebuild, '--type=standby --delta restore') && str_contains($rebuild, 'systemctl unmask'), 'Rebuilding the old primary must unmask it and restore with delta.');
expectReplication(str_contains($rebuild, "sed -i '/^# BEGIN VITO REPLICATION$/,/^# END VITO REPLICATION$/d'"), 'Rebuilding the old primary must drop the replication access it had as the primary.');

$ssh->commands = [];
Queue::fake();
$replicas->delete($other->fresh());
expectReplication($other->fresh()->status === DatabaseReplicaStatus::DELETING && Queue::pushed(DetachDatabaseReplicaJob::class)->count() === 1, 'Deleting a replica must be queued.');
$ssh->failures = ['pg-second:Stopping WAL archiving'];
try {
    $replicas->runDelete($other->fresh());
    throw new LogicException('Deleting an unreachable replica must need a second confirmation.');
} catch (RuntimeException $e) {
    expectReplication(str_contains($e->getMessage(), 'delete the replica again') && DatabaseReplica::query()->find($other->id) !== null, 'An unreachable replica must not be removed silently.');
}
$ssh->failures = [];
$other->update(['configuration' => [...$other->fresh()->configuration, 'detach_unreachable' => false]]);
$replicas->runDelete($other->fresh());
$detach = $ssh->ran('pg-second', 'pg_promote(true, 120)');
expectReplication($detach !== null && strpos($detach, "archive_command = '/bin/true'") < strpos($detach, 'pg_promote'), 'A deleted replica must stop archiving before it becomes independent.');
expectReplication(str_contains((string) $ssh->ran('pg-standby', 'pg_drop_replication_slot'), $other->slot_name), 'Deleting must drop the slot on the primary.');
expectReplication(DatabaseReplica::query()->find($other->id) === null && FirewallRule::query()->where('note', "vito-pg:{$cluster->id}:{$second->id}:5432")->first()?->status === FirewallRuleStatus::DELETING, 'Deleting must remove the replica and its firewall access.');
expectReplication($ssh->ran('pg-standby', 'systemctl restart vito-pgbackrest-server') !== null, 'Deleting a replica while others remain must restart the TLS server with the new client list.');

$cluster->replicas()->update(['status' => DatabaseReplicaStatus::NEEDS_REBUILD]);
$ssh->commands = [];
$replicas->syncBackupServer($cluster->fresh());
expectReplication($ssh->ran('pg-standby', 'systemctl disable --now vito-pgbackrest-server') !== null && $ssh->ran('pg-standby', 'systemctl restart vito-pgbackrest-server') === null
    && ! isset($cluster->fresh()->tls['server_installed_at']), 'A primary without streaming replicas must not try to run a TLS server without allowed clients.');

expectReplicationValidation(fn () => app(ManageBackup::class)->delete($backup->fresh()), 'The backup of a cluster with replicas must not be deleted.');

Illuminate\Support\Sleep::fake();
$hetzner = App\Models\ServerProvider::withoutEvents(fn () => App\Models\ServerProvider::query()->create([
    'user_id' => 1, 'project_id' => 1, 'profile' => 'hetzner', 'provider' => 'hetzner', 'credentials' => ['token' => 'secret-token'], 'connected' => true,
]));
$cloud = ['networks' => [['id' => 5, 'name' => 'office', 'ip_range' => '10.20.0.0/16', 'subnets' => [['network_zone' => 'eu-central']], 'servers' => []]], 'zones' => [], 'attached' => []];
Illuminate\Support\Facades\Http::fake(function (Illuminate\Http\Client\Request $request) use (&$cloud) {
    $path = parse_url($request->url(), PHP_URL_PATH);
    $server = fn (int $id): array => [
        'id' => $id,
        'location' => ['network_zone' => $cloud['zones'][$id]],
        'private_net' => array_map(fn (int $network): array => ['network' => $network, 'ip' => '10.21.0.'.($id % 100)], $cloud['attached'][$id] ?? []),
    ];

    return match (true) {
        $request->method() === 'GET' && $path === '/v1/networks' => Illuminate\Support\Facades\Http::response(['networks' => $cloud['networks'], 'meta' => ['pagination' => ['next_page' => null]]]),
        $request->method() === 'GET' && $path === '/v1/servers' => Illuminate\Support\Facades\Http::response(['servers' => array_map($server, array_keys($cloud['zones'])), 'meta' => ['pagination' => ['next_page' => null]]]),
        $request->method() === 'POST' && $path === '/v1/networks' => (function () use (&$cloud, $request) {
            $cloud['networks'][] = $network = ['id' => 77, 'name' => $request['name'], 'ip_range' => $request['ip_range'], 'subnets' => $request['subnets'], 'labels' => $request['labels'], 'servers' => []];

            return Illuminate\Support\Facades\Http::response(['network' => $network], 201);
        })(),
        $request->method() === 'POST' && str_ends_with($path, '/actions/attach_to_network') => (function () use (&$cloud, $request, $path) {
            $id = (int) explode('/', $path)[3];
            $cloud['attached'][$id][] = $request['network'];
            $cloud['networks'] = array_map(fn (array $network): array => $network['id'] === $request['network'] ? [...$network, 'servers' => [...$network['servers'], $id]] : $network, $cloud['networks']);

            return Illuminate\Support\Facades\Http::response(['action' => ['id' => $id, 'status' => 'running']], 201);
        })(),
        $request->method() === 'GET' && str_starts_with($path, '/v1/actions/') => Illuminate\Support\Facades\Http::response(['action' => ['id' => 1, 'status' => 'success']]),
        $request->method() === 'GET' && str_starts_with($path, '/v1/servers/') => Illuminate\Support\Facades\Http::response(['server' => $server((int) basename($path))]),
    };
});
$makeCloudServer = function (string $name, int $hetznerId, string $zone) use ($makeServer, $hetzner, &$cloud): Server {
    $cloud['zones'][$hetznerId] = $zone;
    $server = $makeServer($name, '198.51.100.'.($hetznerId % 100));
    $server->update(['provider' => 'hetzner', 'provider_id' => $hetzner->id, 'provider_data' => ['hetzner_id' => $hetznerId, 'region' => 'nbg1']]);

    return $server->refresh();
};
$cloudPrimary = $makeCloudServer('cloud-primary', 101, 'eu-central');
$cloudReplica = $makeCloudServer('cloud-replica', 102, 'eu-central');
$faraway = $makeCloudServer('cloud-faraway', 103, 'us-east');
$cloudCluster = PostgresCluster::query()->create(['project_id' => 1, 'primary_server_id' => $cloudPrimary->id, 'stanza' => 'cloud-primary-1']);
$networkPrepare = app(App\Actions\PostgresCluster\PreparePostgresClusterNetwork::class);
$ssh->commands = [];
expectReplication($networkPrepare->prepare($cloudCluster, $cloudReplica) === true, 'Servers on the same Hetzner account must be connected over a Hetzner network.');
$hetznerNetwork = $cloudCluster->fresh()->network;
expectReplication($hetznerNetwork->type->value === 'provider' && $hetznerNetwork->external_id === '77' && ! $cloudCluster->fresh()->owns_network, 'The cluster must use the Hetzner network.');
$created = collect(Illuminate\Support\Facades\Http::recorded())->first(fn (array $pair): bool => $pair[0]->method() === 'POST' && str_ends_with($pair[0]->url(), '/v1/networks'))[0];
expectReplication($created['ip_range'] === '10.21.0.0/16' && $created['subnets'][0] === ['type' => 'cloud', 'network_zone' => 'eu-central', 'ip_range' => '10.21.0.0/24'], 'A new Hetzner network must use a free range in the servers\' network zone.');
expectReplication($hetznerNetwork->firewallRules()->where('name', 'Allow all')->doesntExist(), 'A Hetzner network created for the cluster must not allow all traffic.');
expectReplication($cloudCluster->fresh()->address($cloudReplica) === '10.21.0.2' && str_contains((string) $ssh->ran('cloud-replica', 'VITO_PRIVATE_ADDRESS'), "ADDRESS='10.21.0.2'"), 'Each server must bring up its Hetzner private address.');
expectReplication(str_contains((string) $ssh->ran('cloud-primary', 'VITO_PRIVATE_ADDRESS'), 'UseGateway=false'), 'Bringing up the private interface must never replace the default route.');

$split = PostgresCluster::query()->create(['project_id' => 1, 'primary_server_id' => $cloudPrimary->id, 'stanza' => 'cloud-split-1']);
Queue::fake();
expectReplication($networkPrepare->prepare($split, $faraway) === false && $split->fresh()->network->type->value === 'wireguard' && $split->fresh()->owns_network, 'Servers in different Hetzner network zones must fall back to WireGuard.');

$moving = $makeCloudServer('cloud-moving', 104, 'eu-central');
$movingCluster = PostgresCluster::query()->create(['project_id' => 1, 'primary_server_id' => $moving->id, 'stanza' => 'cloud-moving-1', 'network_id' => $split->fresh()->network_id, 'owns_network' => true]);
$wireguard = $movingCluster->network;
$wireguard->servers()->delete();
$wireguard->servers()->create(['server_id' => $moving->id, 'ip' => '100.64.9.2', 'status' => NetworkServerStatus::ACTIVE]);
$wireguard->servers()->create(['server_id' => $cloudReplica->id, 'ip' => '100.64.9.3', 'status' => NetworkServerStatus::ACTIVE]);
expectReplication($networkPrepare->prepare($movingCluster, $cloudReplica) === true && $movingCluster->fresh()->network->type->value === 'provider', 'A cluster without other replicas must move from its WireGuard network to the Hetzner network.');
expectReplication($wireguard->fresh()->status->value === 'deleting', 'The WireGuard network the cluster no longer uses must be removed.');
$synced = App\Models\Network::query()->where('external_id', '77')->first();
$synced->firewallRules()->create(['name' => 'Allow all', 'protocol' => null, 'port' => null, 'status' => 'ready']);
$adopting = PostgresCluster::query()->create(['project_id' => 1, 'primary_server_id' => $cloudPrimary->id, 'stanza' => 'cloud-adopting-1']);
$networkPrepare->prepare($adopting, $cloudReplica);
expectReplication($adopting->fresh()->network_id === $synced->id && $synced->firewallRules()->where('name', 'Allow all')->doesntExist(), 'A Hetzner network Vito created must lose "Allow all" even when a sync found it first.');

$joiner = $makeCloudServer('cloud-joiner', 105, 'eu-central');
$networksBefore = count($cloud['networks']);
expectReplication($networkPrepare->prepare($movingCluster->fresh(), $joiner) === true && $movingCluster->fresh()->address($joiner) === '10.21.0.5', 'A new replica must join the Hetzner network the cluster already uses.');
expectReplication(count($cloud['networks']) === $networksBefore && in_array(77, $cloud['attached'][105] ?? [], true), 'Joining must reuse the cluster network, not create another one.');
expectReplication($hetznerNetwork->kind() === 'Hetzner private network' && $wireguard->kind() === 'WireGuard'
    && (new App\Http\Resources\PostgresClusterResource($movingCluster->fresh()))->toArray(request())['network']['kind'] === 'Hetzner private network', 'Admins must see whether a cluster uses the Hetzner network or WireGuard.');

$open = PostgresCluster::query()->create(['project_id' => 1, 'primary_server_id' => $bare->id, 'stanza' => 'pg-bare-1']);
expectReplication(app(App\Actions\PostgresCluster\SyncPostgresClusterFirewall::class)->sync($open) === true && FirewallRule::query()->where('note', 'like', "vito-pg:{$open->id}:%")->doesntExist(), 'A primary without a firewall service must not block replicas.');

$tunnel = App\Models\Network::query()->create(['project_id' => 1, 'name' => 'tunnel', 'type' => 'wireguard', 'status' => 'active', 'cidr' => '100.64.5.0/24', 'cidr_canonical' => '100.64.5.0/24', 'port' => 51820]);
$tunnelMembers = collect([[$cloudPrimary, '100.64.5.2', 'KEY-PRIMARY='], [$cloudReplica, '100.64.5.3', 'KEY-REPLICA=']])
    ->map(function (array $member) use ($tunnel): App\Models\NetworkServer {
        Service::query()->create(['server_id' => $member[0]->id, 'type' => 'vpn', 'name' => 'wireguard', 'version' => 'latest', 'status' => 'ready', 'is_default' => true]);

        return $tunnel->servers()->create(['server_id' => $member[0]->id, 'ip' => $member[1], 'public_key' => $member[2], 'private_key' => 'PRIVATE-'.$member[2], 'status' => NetworkServerStatus::ACTIVE]);
    });
$ssh->responses['latest-handshakes'] = "KEY-PRIMARY=\t".now()->subMinute()->getTimestamp()."\nKEY-REPLICA=\t".now()->subMinutes(30)->getTimestamp()."\n";
(new App\Jobs\Network\PollPeerHandshakesJob($tunnel))->handle();
expectReplication($tunnelMembers[0]->fresh()->connected() === true && $tunnelMembers[1]->fresh()->connected() === false, 'Handshakes seen by any member must mark each server connected or not.');
$shown = app(App\Services\VPN\WireGuard::class, ['service' => $cloudReplica->service('vpn')])->config($tunnelMembers[1]->fresh());
expectReplication(str_contains($shown, 'Address = 100.64.5.3/24') && str_contains($shown, 'PublicKey = KEY-PRIMARY=') && ! str_contains($shown, 'PRIVATE-'), 'The configuration shown to admins must hide the private key.');

echo "PostgreSQL cluster network, TLS, restore, backups from standby, health, failover, fencing, rebuild, deletion, Hetzner network and WireGuard status checks passed.\n";
