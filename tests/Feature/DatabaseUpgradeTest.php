<?php

use App\Actions\DatabaseUpgrade\ManageDatabaseUpgrade;
use App\Enums\DatabaseUpgradeStatus;
use App\Enums\FirewallRuleStatus;
use App\Enums\NetworkServerStatus;
use App\Events\SocketEvent;
use App\Exceptions\SSHCommandError;
use App\Facades\SSH as SSHFacade;
use App\Helpers\SSH;
use App\Jobs\DatabaseUpgrade\CancelDatabaseUpgradeJob;
use App\Jobs\DatabaseUpgrade\FinishDatabaseUpgradeJob;
use App\Jobs\DatabaseUpgrade\RunDatabaseUpgradeJob;
use App\Jobs\Service\ManageJob;
use App\Jobs\Service\ToggleNetworkingJob;
use App\Models\DatabaseUpgrade;
use App\Models\FirewallRule;
use App\Models\Metric;
use App\Models\Network;
use App\Models\Project;
use App\Models\Server;
use App\Models\ServerProvider;
use App\Models\Service;
use App\Models\User;
use App\Notifications\DatabaseUpgradeUpdated;
use App\Notifications\NotificationInterface;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Contracts\View\View;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

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
Storage::fake(config('core.key_pairs_disk'));

function expectUpgrade(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

function expectUpgradeValidation(Closure $callback, string $message): void
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

        foreach ($this->failures as $needle) {
            if (str_contains($command, $needle)) {
                throw new App\Exceptions\SSHConnectionError('Cannot connect to 203.0.113.10:22. Error 60. Operation timed out');
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
$user = User::factory()->create(['is_admin' => true]);
$source = Server::withoutEvents(fn () => Server::query()->create([
    'project_id' => 1, 'user_id' => $user->id, 'name' => 'pg-old', 'ip' => '203.0.113.10', 'os' => 'ubuntu_24', 'provider' => 'custom', 'status' => 'ready',
]));
Service::query()->create(['server_id' => $source->id, 'type' => 'database', 'name' => 'postgresql', 'version' => '17', 'status' => 'ready', 'is_default' => true, 'type_data' => ['networking' => false]]);
Service::query()->create(['server_id' => $source->id, 'type' => 'firewall', 'name' => 'ufw', 'version' => 'latest', 'status' => 'ready', 'is_default' => true]);
Metric::query()->create(['server_id' => $source->id, 'load' => 0.1, 'cpu_cores' => 2, 'memory_total' => 3897096, 'memory_used' => 1000000, 'memory_free' => 2897096, 'disk_total' => 38106, 'disk_used' => 3526, 'disk_free' => 34580]);

$hetzner = ServerProvider::withoutEvents(fn () => ServerProvider::query()->create([
    'user_id' => $user->id, 'project_id' => 1, 'profile' => 'hetzner', 'provider' => 'hetzner', 'credentials' => ['token' => 'secret-token'], 'connected' => true,
]));
$serverTypes = collect([['cax11', 2, 4, 40, 'arm'], ['cax01', 1, 2, 10, 'arm']])->map(fn (array $type): array => [
    'name' => $type[0], 'cores' => $type[1], 'memory' => $type[2], 'disk' => $type[3], 'architecture' => $type[4],
    'locations' => [['name' => 'nbg1', 'available' => true]], 'prices' => [],
])->all();
Http::fake(function (Request $request) use ($serverTypes) {
    $path = parse_url($request->url(), PHP_URL_PATH);

    return match (true) {
        $path === '/v1/server_types' => Http::response(['server_types' => $serverTypes]),
        $path === '/v1/ssh_keys' && $request->method() === 'GET' => Http::response(['ssh_keys' => []]),
        $path === '/v1/ssh_keys' => Http::response(['ssh_key' => ['id' => 9]], 201),
        $path === '/v1/servers' => Http::response(['server' => ['id' => 777, 'public_net' => ['ipv4' => ['ip' => '198.51.100.99']]]], 201),
    };
});

$ssh->responses = [
    'pg_largeobject_metadata' => implode("\n", [
        'VITO_VERSION_NUM=170005',
        'VITO_IN_RECOVERY=f',
        'VITO_WAL_LEVEL=replica',
        'VITO_MAX_REPLICATION_SLOTS=10',
        'VITO_USED_SLOTS=9',
        'VITO_MAX_WAL_SENDERS=10',
        'VITO_USED_SENDERS=0',
        'VITO_READ_ONLY=off',
        'VITO_PORT=5432',
        'VITO_SSL=on',
        'VITO_DB|app|10737418240|42|2|1|1|3|pgcrypto postgis',
        'VITO_NOPK|app|public.events',
        'VITO_DB|shop|1073741824|10|0|0|0|0|',
        '',
    ]),
];

$upgrades = app(ManageDatabaseUpgrade::class);
$needs = $upgrades->requirements($source);
expectUpgrade($needs['version'] === 17 && $needs['versions'] === ['18'], 'Only newer PostgreSQL versions may be offered: '.json_encode($needs['versions']));
expectUpgrade($needs['storage_gb'] === 25 && count($needs['databases']) === 2, 'The new server must fit every database with room to grow: '.json_encode($needs['storage_gb']));
expectUpgrade($needs['cores'] === 2 && (float) $needs['memory_gb'] === 3.7, 'vCPU and memory must come from the old server.');
expectUpgrade($needs['restart_needed'] && $needs['required_slots'] === 11 && $needs['required_senders'] === 10, 'A server without wal_level logical and free slots must need a restart: '.json_encode($needs));
expectUpgrade($needs['tables_without_key_count'] === 2 && $needs['tables_without_key'] === ['app.public.events'], 'Tables without a primary key must be reported.');
expectUpgrade(collect($needs['warnings'])->contains(fn (string $warning): bool => str_contains($warning, 'REPLICA IDENTITY FULL'))
    && collect($needs['warnings'])->contains(fn (string $warning): bool => str_contains($warning, 'unlogged'))
    && collect($needs['warnings'])->contains(fn (string $warning): bool => str_contains($warning, 'large objects'))
    && collect($needs['warnings'])->contains(fn (string $warning): bool => str_contains($warning, 'pgcrypto, postgis')), 'The warnings must name what is not copied: '.json_encode($needs['warnings']));

$input = ['mode' => 'logical', 'name' => 'pg-new', 'server_provider' => $hetzner->id, 'region' => 'nbg1', 'plan' => 'cax11', 'version' => '18', 'restart' => true, 'replica_identity' => 'full', 'wal_keep_gb' => '25'];
expectUpgradeValidation(fn () => $upgrades->create($user, $source, [...$input, 'version' => '16']), 'An older PostgreSQL version must be refused.');
expectUpgradeValidation(fn () => $upgrades->create($user, $source, [...$input, 'restart' => false]), 'The restart of the old server must be confirmed.');
expectUpgradeValidation(fn () => $upgrades->create($user, $source, [...$input, 'plan' => 'cax01']), 'A plan without enough disk must be refused.');

Queue::fake();
$upgrade = $upgrades->create($user, $source, $input);
$target = $upgrade->target;
expectUpgrade($target->provider === 'hetzner' && $target->database()?->version === '18' && $target->os->value === 'ubuntu_24', 'The new server must run the chosen PostgreSQL version on the same operating system.');
expectUpgrade($upgrade->status === DatabaseUpgradeStatus::WAITING_FOR_SERVER && Queue::pushed(RunDatabaseUpgradeJob::class)->count() === 1, 'A new upgrade must wait for its server.');
expectUpgrade(! str_contains((string) DB::table('database_upgrades')->value('password'), $upgrade->password), 'The replication password must be stored encrypted.');
expectUpgradeValidation(fn () => $upgrades->create($user, $source, $input), 'A server already upgrading must be refused.');

Queue::fake();
(new RunDatabaseUpgradeJob($upgrade))->handle();
expectUpgrade($upgrade->fresh()->status === DatabaseUpgradeStatus::WAITING_FOR_SERVER && Queue::pushed(RunDatabaseUpgradeJob::class)->count() === 1, 'The upgrade must keep waiting while the server installs.');

$target->update(['status' => 'ready']);
Queue::fake();
(new RunDatabaseUpgradeJob($upgrade))->handle();
expectUpgrade($upgrade->fresh()->status === DatabaseUpgradeStatus::PREPARING, 'A ready server must start the preparation.');

Queue::fake();
(new RunDatabaseUpgradeJob($upgrade))->handle();
$network = Network::query()->find($upgrade->fresh()->network_id);
expectUpgrade($network?->type->value === 'wireguard' && $upgrade->fresh()->owns_network, 'Servers without a shared network must get a WireGuard network for the copy.');
expectUpgrade($network->firewallRules()->where('name', 'Allow all')->doesntExist(), 'The upgrade network must not allow all traffic between the servers.');
$network->servers()->update(['status' => NetworkServerStatus::ACTIVE]);
$address = fn (Server $server): string => $network->servers()->where('server_id', $server->id)->value('ip');

$ssh->responses['SHOW listen_addresses'] = 'localhost';
Queue::fake();
(new RunDatabaseUpgradeJob($upgrade))->handle();
expectUpgrade(Queue::pushed(ToggleNetworkingJob::class)->count() === 1 && $source->database()->status->value === 'restarting', 'PostgreSQL on the old server must listen on the private address.');

expectUpgrade($source->database()->handler()->listenAddresses(false) === 'localhost,'.$address($source),
    'PostgreSQL on the old server must be told to listen on the address the new server reaches it on: '.$source->database()->handler()->listenAddresses(false));
$source->database()->update(['status' => 'ready']);
$ssh->responses['SHOW listen_addresses'] = 'localhost,'.$address($source);
Queue::fake();
(new RunDatabaseUpgradeJob($upgrade))->handle();
$rule = FirewallRule::query()->where('note', 'vito-pg-upgrade:'.$upgrade->id.':5432')->first();
expectUpgrade($rule !== null && $rule->server_id === $source->id && $rule->source === $address($target) && $rule->port === '5432', 'Only the new server may reach PostgreSQL on the old one.');
$rule->update(['status' => FirewallRuleStatus::READY]);

$stalled = DatabaseUpgrade::query()->find($upgrade->id);
$stalled->update(['configuration' => [...$stalled->configuration, 'preparing_since' => now()->subHours(1)->toIso8601String()]]);
$stalledError = null;
try {
    $upgrades->prepare($stalled->fresh());
} catch (Throwable $e) {
    $stalledError = $e->getMessage();
}
expectUpgrade($stalledError !== null && str_contains($stalledError, 'did not get past'), 'A preparation step that never finishes must fail with the step it stopped on, not wait for ever: '.$stalledError);
$stalled->update(['configuration' => [...$stalled->configuration, 'preparing_since' => now()->toIso8601String()]]);

$ssh->responses['CREATE PUBLICATION'] = "VITO_WAL_LEVEL=replica\nVITO_MAX_REPLICATION_SLOTS=10\nVITO_MAX_WAL_SENDERS=10\nVITO_PORT=5432\nVITO_SSL=on\n";
Queue::fake();
(new RunDatabaseUpgradeJob($upgrade))->handle();
expectUpgrade(Queue::pushed(ManageJob::class)->count() === 1 && str_contains((string) $upgrade->fresh()->step, 'Restarting PostgreSQL'), 'Settings that only apply after a restart must restart PostgreSQL once.');
$source->database()->update(['status' => 'ready']);

$ssh->responses['CREATE PUBLICATION'] = "VITO_WAL_LEVEL=logical\nVITO_MAX_REPLICATION_SLOTS=11\nVITO_MAX_WAL_SENDERS=10\nVITO_PORT=5432\nVITO_SSL=on\n";
$ssh->responses['max_logical_replication_workers = '] = "VITO_MAX_WORKER_PROCESSES=14\nVITO_MAX_LOGICAL_REPLICATION_WORKERS=6\nVITO_MAX_REPLICATION_SLOTS=10\n";
$ssh->responses['pg_dumpall --roles-only'] = "CREATE ROLE app;\nALTER ROLE app WITH LOGIN PASSWORD 'SCRAM-SHA-256\$4096:salt\$stored:server';\nCREATE ROLE vito_upgrade_leftover;\n";
$ssh->commands = [];
Queue::fake();
(new RunDatabaseUpgradeJob($upgrade))->handle();
$upgrade->refresh();
expectUpgrade($upgrade->status === DatabaseUpgradeStatus::COPYING, 'The copy must start once both servers are prepared.');

$roleSql = $ssh->writes['pg-old:/var/lib/postgresql/vito-upgrade-'.$upgrade->id.'.sql']['content'] ?? '';
expectUpgrade(str_contains($roleSql, 'REPLICATION LOGIN') && str_contains($roleSql, 'GRANT pg_read_all_data') && str_contains($roleSql, $upgrade->password), 'The replication role must be created from a file, not from the command line.');
expectUpgrade($ssh->ran('pg-old', "sudo install -m 600 -o postgres -g postgres /dev/null '/var/lib/postgresql/vito-upgrade-{$upgrade->id}.sql'") !== null, 'The role file must be created as postgres with mode 600 before the password is written into it.');

$prepared = $ssh->ran('pg-old', 'CREATE PUBLICATION');
expectUpgrade(str_contains($prepared, "'{$upgrade->username}' '".$address($target)."/32'") && ! str_contains($prepared, $upgrade->password), 'pg_hba.conf must allow the new server only, without logging the password.');
expectUpgrade(str_contains($prepared, "wal_level = 'logical'") && str_contains($prepared, 'max_replication_slots = 11') && str_contains($prepared, 'REPLICA IDENTITY FULL'), 'The old server must get the settings and replica identities logical replication needs.');
expectUpgrade(str_contains($prepared, "max_slot_wal_keep_size = '25GB'"), 'The old server must keep only the WAL the admin allowed, so a slow copy cannot fill its disk.');
expectUpgrade(str_contains($copy ?? $ssh->ran('pg-new', 'systemd-run') ?? '', 'GRANT %s ON DATABASE %I TO %s') && str_contains($ssh->ran('pg-new', 'systemd-run') ?? '', 'pg_db_role_setting'),
    'The grants and settings of each database must travel with it.');
foreach (['app', 'shop'] as $database) {
    expectUpgrade(str_contains($prepared, "-d '{$database}' -v pub='vito_upgrade_{$upgrade->id}'"), "The database {$database} must be published.");
}
expectUpgrade(str_contains($prepared, "CREATE PUBLICATION %I FOR ALL TABLES"), 'The publication must be created from a statement psql can parse.');

$passfile = $ssh->writes['pg-new:/var/lib/postgresql/.vito-upgrade-'.$upgrade->id.'.pgpass'] ?? null;
expectUpgrade($passfile !== null && $passfile['owner'] === 'postgres' && str_contains($passfile['content'], $address($source).':5432:*:'.$upgrade->username.':'.$upgrade->password), 'The new server must read the password from a passfile.');
$roles = $ssh->writes['pg-new:/var/lib/postgresql/vito-upgrade-'.$upgrade->id.'-roles.sql']['content'] ?? '';
expectUpgrade(str_contains($roles, 'CREATE ROLE app') && str_contains($roles, 'SCRAM-SHA-256') && ! str_contains($roles, 'vito_upgrade_leftover'), 'The roles of the old server must be copied without the roles Vito created for the upgrade.');

$copy = $ssh->ran('pg-new', 'systemd-run');
foreach ([
    '"$PG_DUMP" -d "$CONN" --schema-only --no-publications --no-subscriptions', 'CREATE SUBSCRIPTION :"sub" CONNECTION :\'conn\' PUBLICATION :"pub" WITH (copy_data = true, streaming = on);',
    'host='.$address($source).' port=5432 user='.$upgrade->username.' dbname=app', 'sslmode=require', "vito_upgrade_{$upgrade->id}_0", "vito_upgrade_{$upgrade->id}_1",
] as $needle) {
    expectUpgrade(str_contains($copy, $needle), "The copy script must contain {$needle}.");
}
expectUpgrade(! str_contains($copy, $upgrade->password), 'The copy script must not contain the password.');
// Rows arrive far faster into a table without secondary indexes, and the indexes are cheaper to build once at the
// end than to maintain row by row. Primary keys, unique and exclusion indexes stay: the apply worker needs them.
foreach (['DROP INDEX %I.%I', 'NOT i.indisprimary AND NOT i.indisunique', 'wait_for_copy', 'build_indexes',
    'CREATE INDEX CONCURRENTLY IF NOT EXISTS', 'NOT i.indisvalid', 'could not be built'] as $needle) {
    expectUpgrade(str_contains($copy, $needle), "The copy script must defer the secondary indexes: {$needle}.");
}
expectUpgrade(strpos($copy, 'CREATE SUBSCRIPTION') < strpos($copy, 'build_indexes()'), 'The indexes must be built after the copy, not before it.');
expectUpgrade(str_contains($copy, "PASSWORD '<redacted>'"), 'The copy script must redact the password hashes of the roles it applies, because their errors end up in the journal.');

$ssh->responses['systemctl show'] = "LoadState=loaded\nActiveState=active\nSubState=exited\nResult=success\n";
$ssh->responses['pg_subscription_rel'] = "VITO_SUB|app|42|10|2|0|3\nVITO_SUB|shop|10|10|1|0|2\n";
$ssh->responses['VITO_SLOT|'] = "VITO_SLOT|vito_upgrade_{$upgrade->id}_0|true|2048|reserved\nVITO_SLOT|vito_upgrade_{$upgrade->id}_1|true|0|reserved\nVITO_READ_ONLY=off\n";
Queue::fake();
(new RunDatabaseUpgradeJob($upgrade))->handle();
$upgrade->refresh();
expectUpgrade($upgrade->status === DatabaseUpgradeStatus::COPYING && str_contains((string) $upgrade->step, '20 of 52 tables') && $upgrade->progress() === 38.5, 'A running copy must show how many tables it copied.');
expectUpgradeValidation(fn () => $upgrades->finish($upgrade->fresh()), 'An upgrade that is still copying must not be finished.');

// The unit is gone once Vito cleaned it up, and that must not read as a copy that died.
$ssh->responses['systemctl show'] = "LoadState=not-found\nActiveState=inactive\nSubState=dead\nResult=success\n";
$ssh->responses['pg_subscription_rel'] = "VITO_SUB|app|42|42|2|0|3\nVITO_SUB|shop|10|10|1|0|2\n";
$ssh->responses['VITO_SLOT|'] = "VITO_SLOT|vito_upgrade_{$upgrade->id}_0|true|0|reserved\nVITO_SLOT|vito_upgrade_{$upgrade->id}_1|true|0|reserved\nVITO_READ_ONLY=off\n";
$notifier->sent = [];
Queue::fake();
(new RunDatabaseUpgradeJob($upgrade))->handle();
$upgrade->refresh();
expectUpgrade($upgrade->status === DatabaseUpgradeStatus::STREAMING && $upgrade->caught_up_at !== null, 'An upgrade that copied everything must wait for the switch.');
expectUpgrade($notifier->sent[0] instanceof DatabaseUpgradeUpdated, 'The admin must hear when the new server is in sync.');

$ssh->responses['VITO_SLOT|'] = "VITO_SLOT|vito_upgrade_{$upgrade->id}_0|true|0|lost\nVITO_SLOT|vito_upgrade_{$upgrade->id}_1|true|0|reserved\nVITO_READ_ONLY=off\n";
Queue::fake();
(new RunDatabaseUpgradeJob($upgrade))->handle();
expectUpgrade($upgrade->fresh()->status === DatabaseUpgradeStatus::FAILED && str_contains((string) $upgrade->fresh()->message, 'dropped WAL the copy had not applied'),
    'A slot the old server invalidated must stop the upgrade with the reason, not keep copying into a hole.');
$upgrade->update(['status' => DatabaseUpgradeStatus::STREAMING, 'message' => null, 'finished_at' => null]);

$ssh->responses['VITO_SLOT|'] = "VITO_SLOT|vito_upgrade_{$upgrade->id}_0|true|0|reserved\nVITO_READ_ONLY=off\n";
Queue::fake();
(new RunDatabaseUpgradeJob($upgrade))->handle();
expectUpgrade($upgrade->fresh()->status === DatabaseUpgradeStatus::FAILED && str_contains((string) $upgrade->fresh()->message, 'replication slot of this upgrade disappeared'), 'A slot that disappears must stop the upgrade instead of losing rows.');
$upgrade->update(['status' => DatabaseUpgradeStatus::STREAMING, 'message' => null, 'finished_at' => null]);
$ssh->responses['VITO_SLOT|'] = "VITO_SLOT|vito_upgrade_{$upgrade->id}_0|true|0|reserved\nVITO_SLOT|vito_upgrade_{$upgrade->id}_1|true|0|reserved\nVITO_READ_ONLY=off\n";

Queue::fake();
$upgrades->finish($upgrade->fresh());
expectUpgrade($upgrade->fresh()->status === DatabaseUpgradeStatus::FINISHING && Queue::pushed(FinishDatabaseUpgradeJob::class)->count() === 1, 'Finishing must be queued.');

$ssh->responses['ALTER SYSTEM SET default_transaction_read_only = on'] = "VITO_LSN=0/5000000\nVITO_REMAINING=1\nVITO_SLOTS=2\n";
$thrown = null;
try {
    $upgrades->runFinish($upgrade->fresh());
} catch (Throwable $e) {
    $thrown = $e;
}
expectUpgrade($thrown instanceof RuntimeException && str_contains($thrown->getMessage(), 'did not apply everything'), 'A switch that did not catch up must stop before anything else changes.');
(new FinishDatabaseUpgradeJob($upgrade->fresh()))->failed(new Exception($thrown->getMessage()));
expectUpgrade($upgrade->fresh()->status === DatabaseUpgradeStatus::STREAMING && str_contains((string) $upgrade->fresh()->message, 'did not apply everything'), 'A switch that stops before the old server gives up its writes must be retryable.');

$ssh->responses['ALTER SYSTEM SET default_transaction_read_only = on'] = "VITO_LSN=0/5000000\nVITO_REMAINING=0\nVITO_SLOTS=2\n";
$ssh->commands = [];
$notifier->sent = [];
$upgrade->update(['status' => DatabaseUpgradeStatus::FINISHING, 'message' => null]);
Queue::fake();
(new FinishDatabaseUpgradeJob($upgrade->fresh()))->handle();
$upgrade->refresh();
expectUpgrade($upgrade->status === DatabaseUpgradeStatus::COMPLETED && $upgrade->finished_at !== null, 'A finished switch must complete the upgrade.');

$cutover = $ssh->ran('pg-old', 'ALTER SYSTEM SET default_transaction_read_only = on');
expectUpgrade(str_contains($cutover, "backend_type = 'client backend'") && str_contains($cutover, "usename IS DISTINCT FROM 'postgres'"), 'The switch must disconnect the applications of the old server but keep Vito connected.');
$switch = $ssh->ran('pg-new', 'pg_catalog.setval');
expectUpgrade(str_contains($switch, 'FROM pg_sequences') && str_contains($switch, 'DROP SUBSCRIPTION') && str_contains($switch, "vito_upgrade_{$upgrade->id}_1"), 'The switch must copy the sequence values and stop every subscription.');
$cleanup = $ssh->ran('pg-old', 'DROP PUBLICATION');
// The switch left the server read-only, and DDL is refused in a read-only transaction, so every cleanup session
// has to make itself writable first — else the publication, the role and the slots stay behind for ever.
foreach (preg_split('/\R/', (string) $cleanup) ?: [] as $index => $line) {
    if (preg_match('/^(DROP|SELECT pg_(drop_replication_slot|terminate_backend)|ALTER SYSTEM)/', trim($line)) === 1) {
        $block = array_slice(preg_split('/\R/', (string) $cleanup) ?: [], 0, $index);
        $opened = array_filter($block, fn (string $earlier): bool => str_contains($earlier, 'SET default_transaction_read_only = off'));
        expectUpgrade($opened !== [], 'Cleaning up must turn the session writable before: '.trim($line));
    }
}
expectUpgrade(str_contains($cleanup, 'DROP ROLE IF EXISTS') && str_contains($cleanup, 'pg_drop_replication_slot') && ! str_contains($cleanup, 'RESET default_transaction_read_only'), 'Cleaning up must remove what Vito added and leave the old server read-only.');
expectUpgrade(! str_contains($cleanup, 'BEGIN VITO UPGRADE') || str_contains($cleanup, "sed -i '/^# BEGIN VITO UPGRADE"), 'The pg_hba rule of the upgrade must be removed.');
expectUpgrade(FirewallRule::query()->where('note', 'vito-pg-upgrade:'.$upgrade->id.':5432')->value('status') === FirewallRuleStatus::DELETING, 'The firewall rule of the upgrade must be removed.');
expectUpgrade($upgrade->network_id === null && Network::query()->whereKey($network->id)->value('status') !== 'ready', 'A network Vito created only for the upgrade must be removed.');
expectUpgrade($notifier->sent[0] instanceof DatabaseUpgradeUpdated, 'A finished upgrade must notify.');
expectUpgradeValidation(fn () => $upgrades->cancel($upgrade->fresh()), 'A completed upgrade must not be cancelled.');

$upgrade->update(['status' => DatabaseUpgradeStatus::COPYING, 'finished_at' => null]);
Queue::fake();
$upgrades->cancel($upgrade->fresh());
expectUpgrade($upgrade->fresh()->status === DatabaseUpgradeStatus::CANCELLING && Queue::pushed(CancelDatabaseUpgradeJob::class)->count() === 1, 'Cancelling must be queued.');
$ssh->commands = [];
(new CancelDatabaseUpgradeJob($upgrade->fresh()))->handle();
$cancelled = $ssh->ran('pg-old', 'DROP PUBLICATION');
expectUpgrade($upgrade->fresh()->status === DatabaseUpgradeStatus::CANCELLED && str_contains($cancelled, 'RESET default_transaction_read_only'), 'Cancelling must let the old server take writes again.');
expectUpgrade(str_contains((string) $ssh->ran('pg-new', 'DROP SUBSCRIPTION'), 'drop_subscription') && ! str_contains((string) $ssh->ran('pg-new', 'DROP SUBSCRIPTION'), 'pg_catalog.setval'), 'Cancelling must stop the subscriptions without copying the sequence values.');

// === a seeded upgrade: the new server starts from a physical backup and replicates only what came after ===
$seedable = $upgrades->seedable($source->fresh());
expectUpgrade(! $seedable['available'] && str_contains((string) $seedable['reason'], 'no pgBackRest backup'), 'Without a backup the new server cannot be seeded from one: '.json_encode($seedable));
expectUpgradeValidation(fn () => $upgrades->create($user, $source->fresh(), [...$input, 'mode' => 'seeded']), 'A seeded upgrade without a backup must be refused.');

$storage = App\Models\StorageProvider::withoutEvents(fn () => App\Models\StorageProvider::query()->create([
    'user_id' => $user->id, 'profile' => 'Backups', 'provider' => 's3',
    'credentials' => ['api_url' => 'https://s3.example.test', 'key' => 'k', 'secret' => 's', 'region' => 'eu', 'bucket' => 'b', 'path' => ''],
]));
$backup = App\Models\Backup::withoutEvents(fn () => App\Models\Backup::query()->create([
    'type' => 'pgbackrest', 'server_id' => $source->id, 'storage_id' => $storage->id, 'status' => null,
    'configuration' => [
        'stanza' => 'pg-old-1', 'strategy' => 'standard', 'pg_path' => '/var/lib/postgresql/17/main', 'pg_port' => 5432,
        'cipher_pass' => 'a-passphrase', 'process_max' => 4, 'wal_queue_max_gb' => 10, 'retention' => ['full' => 5],
    ],
    'interval' => '0 2 * * *', 'keep_backups' => 5,
]));
App\Models\PostgresCluster::query()->create(['project_id' => 1, 'primary_server_id' => $source->id, 'backup_id' => $backup->id, 'stanza' => 'pg-old-1']);
App\Models\BackupFile::withoutEvents(fn () => App\Models\BackupFile::query()->create([
    'backup_id' => $backup->id, 'name' => '20261001-020000F', 'status' => App\Enums\BackupFileStatus::CREATED, 'type' => 'full',
]));
expectUpgrade($upgrades->seedable($source->fresh())['available'], 'A finished pgBackRest backup must make the seeded mode available.');

$upgrade->update(['status' => DatabaseUpgradeStatus::CANCELLED, 'finished_at' => now()]);
Queue::fake();
$seeded = $upgrades->create($user, $source->fresh(), [...$input, 'mode' => 'seeded', 'name' => 'pg-seeded']);
$seeded->target->update(['status' => 'ready']);
$seededTarget = $seeded->target;
expectUpgrade($seeded->seeded() && $seeded->status === DatabaseUpgradeStatus::WAITING_FOR_SERVER, 'A seeded upgrade must start by waiting for its server.');

$ssh->responses['VITO_LSN|'] = "VITO_LSN|app|0/16B3C70\nVITO_LSN|shop|0/16B3D10\n";
$ssh->commands = [];
(new RunDatabaseUpgradeJob($seeded))->handle();   // the server is ready, so the preparation starts
(new RunDatabaseUpgradeJob($seeded))->handle();   // which creates the private network
$seededNetwork = $seeded->fresh()->network;
expectUpgrade($seededNetwork !== null, 'A seeded upgrade must get a private network too.');
$seededNetwork->servers()->update(['status' => NetworkServerStatus::ACTIVE]);
$ssh->responses['SHOW listen_addresses'] = 'localhost,'.$seededNetwork->servers()->where('server_id', $source->id)->value('ip');
(new RunDatabaseUpgradeJob($seeded))->handle();
FirewallRule::query()->where('note', 'vito-pg-upgrade:'.$seeded->id.':5432')->update(['status' => FirewallRuleStatus::READY]);
(new RunDatabaseUpgradeJob($seeded))->handle();
$seeded->refresh();

if ($seeded->status !== DatabaseUpgradeStatus::SEEDING) {
    (new RunDatabaseUpgradeJob($seeded->fresh()))->handle();
    $seeded->refresh();
}
expectUpgrade($seeded->status === DatabaseUpgradeStatus::SEEDING, 'A seeded upgrade must restore the backup instead of copying the rows: '.$seeded->status->value.' / '.$seeded->step.' / '.json_encode(array_slice($seeded->events ?? [], -3)));
expectUpgrade(($seeded->configuration['slot_lsn']['app'] ?? null) === '0/16B3C70', 'The position each slot starts at must be kept, because the restore and the subscription both have to match it.');

$seedScript = $ssh->ran($seededTarget->name, 'vito-upgrade-seed-'.$seeded->id);
foreach (['--type=lsn --target=', "'0/16B3C70'", 'pg_upgradecluster --method=upgrade --link', 'pg_dropcluster "$OLD" main --stop', 'analyze-in-stages'] as $needle) {
    expectUpgrade(str_contains((string) $seedScript, $needle), "The seed script must contain {$needle}.");
}
expectUpgrade(strpos((string) $seedScript, 'restore') < strpos((string) $seedScript, 'pg_upgradecluster'), 'The copy must be restored before it is upgraded.');

$ssh->responses['systemctl show'] = "LoadState=loaded\nActiveState=active\nSubState=exited\nResult=success\n";
$ssh->responses['max_logical_replication_workers = '] = "VITO_MAX_WORKER_PROCESSES=14\nVITO_MAX_LOGICAL_REPLICATION_WORKERS=6\nVITO_MAX_REPLICATION_SLOTS=10\n";
$ssh->commands = [];
(new RunDatabaseUpgradeJob($seeded->fresh()))->handle();
$seeded->refresh();

$subscribe = $ssh->ran($seededTarget->name, 'CREATE SUBSCRIPTION');
foreach (['copy_data = false', 'create_slot = false', "slot_name = :'slot'", 'pg_replication_origin_advance', "0/16B3C70"] as $needle) {
    expectUpgrade(str_contains((string) $subscribe, $needle), "The seeded subscription must contain {$needle}.");
}
expectUpgrade($seeded->status === DatabaseUpgradeStatus::COPYING && ($seeded->configuration['copy_prepared'] ?? false) === true,
    'Once the copy is restored and following the old server, the upgrade is catching up: '.$seeded->status->value);
$seeded->update(['status' => DatabaseUpgradeStatus::CANCELLED, 'finished_at' => now()]);
$upgrade->update(['status' => DatabaseUpgradeStatus::COPYING, 'finished_at' => null]);

DatabaseUpgrade::query()->whereKey($upgrade->id)->update(['status' => 'copying', 'updated_at' => now()->subHour()]);
Queue::fake();
Artisan::call('database-replicas:check');
expectUpgrade(Queue::pushed(RunDatabaseUpgradeJob::class)->count() === 1, 'An upgrade Vito stopped watching must be picked up again.');

// psql reads a -c argument as plain SQL for the server: it interpolates no :'variable' and runs no backslash
// command there, so both come back as "syntax error at or near" from a real terminal while every faked test passes.
// Anything that needs either has to arrive on stdin.
foreach (glob(dirname(__DIR__, 2).'/resources/views/ssh/database-upgrade/*.blade.php') as $script) {
    foreach (preg_split('/\R/', file_get_contents($script)) ?: [] as $line) {
        preg_match_all('/ -c "((?:[^"\\\\]|\\\\.)*)"/', $line, $arguments);

        foreach ($arguments[1] as $argument) {
            expectUpgrade(preg_match('/\\\\[a-z]|:\x27|:\\\\?"/', $argument) !== 1,
                'A psql -c argument must carry plain SQL, not a variable or a backslash command: '.basename($script).' -> '.trim($line));
        }
    }
}

$ssh->failures = ['pg_largeobject_metadata'];
Illuminate\Support\Facades\Auth::loginUsingId($user->id);
$unreachable = app(App\Http\Controllers\DatabaseUpgradeController::class)->requirements($source);
expectUpgrade($unreachable->getStatusCode() === 422 && str_contains((string) $unreachable->getContent(), 'Operation timed out'),
    'A server Vito cannot reach must say so in the dialog instead of leaving it empty: '.$unreachable->getContent());
$ssh->failures = [];

echo "PostgreSQL version upgrade preflight, preparation, copy, switch, cancel and unreachable-server checks passed.\n";
