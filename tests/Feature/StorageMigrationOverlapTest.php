<?php

use App\Actions\StorageMigration\BroadcastStorageMigrationUpdate;
use App\Actions\StorageMigration\ManageStorageMigrationDatabase;
use App\Enums\FirewallRuleStatus;
use App\Enums\StorageMigrationItemStatus;
use App\Enums\StorageMigrationStatus;
use App\Jobs\StorageMigration\CopyStorageMigrationItems;
use App\Jobs\StorageMigration\PrepareStorageMigration;
use App\Models\StorageMigration;
use App\Support\S3ObjectCopier;
use Aws\MockHandler;
use Aws\Result;
use Aws\S3\S3Client;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
set_exception_handler(function (Throwable $error): void {
    fwrite(STDERR, $error->getMessage()."\n");
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
$app->instance(BroadcastStorageMigrationUpdate::class, new class extends BroadcastStorageMigrationUpdate
{
    public function broadcast(StorageMigration $storageMigration): void {}
});

function expectMigration(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

function invokeMigration(object $job, string $method): void
{
    (new ReflectionMethod($job, $method))->invoke($job);
}

function migrationClient(array $results): S3Client
{
    return new S3Client([
        'region' => 'us-east-1', 'version' => 'latest',
        'credentials' => ['key' => 'test', 'secret' => 'test'],
        'handler' => new MockHandler($results),
    ]);
}

function recordingClient(array &$calls, array $results): S3Client
{
    $queue = [];
    foreach ($results as $result) {
        $queue[] = function (Aws\CommandInterface $command) use (&$calls, $result): Result {
            $calls[] = $command->getName();

            return $result;
        };
    }

    return migrationClient($queue);
}

$migration = StorageMigration::query()->create([
    'project_id' => 1, 'source_storage_id' => 1, 'target_storage_id' => 2,
    'status' => StorageMigrationStatus::SCANNING, 'overwrite' => true,
]);
$database = app(ManageStorageMigrationDatabase::class);
expectMigration($database->ready($migration), 'A migration without a scan database must use the default connection.');
$job = new CopyStorageMigrationItems($migration);
expectMigration($job->connection === 'storage-migration', 'Copy connection is incorrect.');
expectMigration((new PrepareStorageMigration($migration))->connection === 'storage-migration-scan', 'Scan connection is incorrect.');
invokeMigration($job, 'runCopyCycle');
expectMigration($migration->fresh()->status === StorageMigrationStatus::SCANNING, 'An empty scan must not finish.');
$queued = Queue::pushed(CopyStorageMigrationItems::class);
expectMigration($queued->count() === 1 && $queued->first()->delay !== null, 'Empty scan must schedule a delayed copy check.');

$item = $migration->items()->create([
    'source_key' => 'first', 'source_key_hash' => sha1('first'), 'target_key' => 'first', 'size' => 3,
    'status' => StorageMigrationItemStatus::PENDING,
]);
foreach ([
    'copier' => new S3ObjectCopier,
    'sourceClient' => migrationClient([new Result(['Body' => 'abc'])]), 'sourceBucket' => 'source',
    'targetClient' => migrationClient([new Result(['ETag' => '"900150983cd24fb0d6963f7d28e17f72"'])]),
    'targetBucket' => 'target',
] as $property => $value) {
    (new ReflectionProperty($job, $property))->setValue($job, $value);
}
invokeMigration($job, 'runCopyCycle');
expectMigration($item->fresh()->status === StorageMigrationItemStatus::PENDING, 'Transfers must wait for the target listing instead of asking the target about each object.');
$migration->update(['target_scan_completed_at' => now()]);
invokeMigration($job, 'runCopyCycle');
expectMigration($item->fresh()->status === StorageMigrationItemStatus::COPIED, 'Discovered objects must be processed before scan completion.');
expectMigration($migration->fresh()->scan_completed_at === null, 'Copying must not finish discovery.');
expectMigration($migration->fresh()->items_copied === 1, 'Live progress must update while scanning.');
expectMigration($migration->fresh()->bytes_copied === 3, 'Transferred bytes must be recorded during discovery.');
expectMigration($migration->fresh()->last_activity_at !== null, 'Transfers must record activity.');

$migration->update(['status' => StorageMigrationStatus::PAUSED]);
Queue::fake();
invokeMigration($job, 'runCopyCycle');
expectMigration($migration->fresh()->status === StorageMigrationStatus::PAUSED, 'Copy worker must preserve pause.');
expectMigration(Queue::pushed(CopyStorageMigrationItems::class)->isEmpty(), 'A paused worker must not dispatch more work.');
$migration->update(['status' => StorageMigrationStatus::RUNNING, 'scan_completed_at' => now()]);
invokeMigration($job, 'runCopyCycle');
expectMigration($migration->fresh()->status === StorageMigrationStatus::VERIFYING, 'Verification must start after scan and copy finish.');
invokeMigration($job, 'settle');
expectMigration($migration->fresh()->status === StorageMigrationStatus::COMPLETED, 'Settled migration must complete.');
$migration->update(['status' => StorageMigrationStatus::CANCELLED]);
invokeMigration($job, 'settle');
expectMigration($migration->fresh()->status === StorageMigrationStatus::CANCELLED, 'Settlement must preserve cancellation.');

$controls = app(App\Actions\StorageMigration\ManageStorageMigration::class);
$migration->update(['status' => StorageMigrationStatus::SCANNING, 'scan_completed_at' => null]);
$controls->pause($migration, ['phase' => 'scan']);
expectMigration($migration->fresh()->scan_paused && ! $migration->fresh()->transfer_paused, 'Scan pause must leave transfers active.');
$controls->pause($migration, ['phase' => 'transfer']);
expectMigration($migration->fresh()->status === StorageMigrationStatus::PAUSED, 'Both paused phases must pause the migration.');
Queue::fake();
$controls->resume($migration, ['phase' => 'transfer']);
expectMigration($migration->fresh()->scan_paused && ! $migration->fresh()->transfer_paused, 'Transfer resume must preserve scan pause.');
expectMigration(Queue::pushed(PrepareStorageMigration::class)->isEmpty(), 'Transfer resume must not restart a paused scanner.');
expectMigration(Queue::pushed(CopyStorageMigrationItems::class)->count() === 1, 'Transfer resume must start a copy worker.');
$controls->pause($migration, ['phase' => 'transfer']);
Queue::fake();
$controls->resume($migration, ['phase' => 'scan']);
expectMigration(! $migration->fresh()->scan_paused && $migration->fresh()->transfer_paused, 'Scan resume must preserve transfer pause.');
expectMigration(Queue::pushed(PrepareStorageMigration::class)->count() === 1, 'Scan resume must restart discovery.');
expectMigration(Queue::pushed(CopyStorageMigrationItems::class)->isEmpty(), 'Scan resume must not restart paused transfers.');
invokeMigration($job, 'runCopyCycle');
expectMigration($migration->fresh()->status === StorageMigrationStatus::SCANNING, 'Paused transfers must not finalize a scanning migration.');

$credentials = ['bucket' => 'test', 'key' => 'test', 'secret' => 'test', 'region' => 'us-east-1', 'path' => ''];
$source = App\Models\StorageProvider::withoutEvents(fn () => App\Models\StorageProvider::query()->create([
    'user_id' => 1, 'profile' => 'Test source', 'provider' => 's3', 'credentials' => $credentials,
]));
$target = App\Models\StorageProvider::withoutEvents(fn () => App\Models\StorageProvider::query()->create([
    'user_id' => 1, 'profile' => 'Test target', 'provider' => 's3', 'credentials' => $credentials,
]));
$scan = StorageMigration::query()->create([
    'project_id' => 1, 'source_storage_id' => $source->id, 'target_storage_id' => $target->id,
    'status' => StorageMigrationStatus::SCANNING, 'target_scan_completed_at' => now(),
]);
$scanner = new class($scan) extends S3ObjectCopier
{
    public array $tokens = [];

    public function __construct(private StorageMigration $migration) {}

    public function listPage(S3Client $client, string $bucket, string $prefix, ?string $continuationToken, int $maxKeys = 1000): array
    {
        $this->tokens[] = $continuationToken;
        if ($continuationToken === null) {
            app(App\Actions\StorageMigration\ManageStorageMigration::class)->pause($this->migration, ['phase' => 'scan']);
            return ['objects' => [['key' => 'one', 'size' => 3]], 'nextToken' => 'page-two'];
        }
        return ['objects' => [['key' => 'two', 'size' => 4]], 'nextToken' => null];
    }
};
$app->instance(S3ObjectCopier::class, $scanner);
(new PrepareStorageMigration($scan))->handle();
expectMigration($scan->fresh()->scan_cursor === 'page-two', 'Pausing must persist the completed page cursor.');
expectMigration($scan->fresh()->items_total === 1 && $scan->fresh()->scan_completed_at === null, 'Scan must stop after its current page.');
$controls->resume($scan, ['phase' => 'scan']);
(new PrepareStorageMigration($scan))->handle();
expectMigration($scanner->tokens === [null, 'page-two'], 'Resuming must continue from the saved page.');
expectMigration($scan->fresh()->items_total === 2 && $scan->fresh()->bytes_total === 7, 'Resume must preserve accurate totals.');
expectMigration($scan->fresh()->scan_completed_at !== null, 'Scan must complete after its final page.');
expectMigration($scan->fresh()->isSyncing(), 'A migration with recent activity must be syncing.');
Illuminate\Support\Carbon::setTestNow(now()->addMinutes(3));
expectMigration(! $scan->fresh()->isSyncing(), 'A migration without recent activity must not be syncing.');
Illuminate\Support\Carbon::setTestNow();
$scan->update(['status' => StorageMigrationStatus::PAUSED]);
expectMigration(! $scan->fresh()->isSyncing(), 'A paused migration must not be syncing.');
expectMigration((new StorageMigration(['items_total' => 8, 'items_copied' => 2, 'items_skipped' => 1, 'items_failed' => 1]))->progress() === 50.0, 'Progress must count every settled object.');
$controls->update($scan, ['name' => 'Camera archive']);
expectMigration($scan->fresh()->name === 'Camera archive', 'Renaming must store the name.');
try {
    $controls->update($scan, ['name' => '']);
    throw new LogicException('A blank name must fail validation.');
} catch (Illuminate\Validation\ValidationException) {
}

$parallel = StorageMigration::query()->create([
    'project_id' => 1, 'source_storage_id' => $source->id, 'target_storage_id' => $target->id,
    'status' => StorageMigrationStatus::RUNNING, 'scan_completed_at' => now(), 'worker_count' => 2,
]);
config(['storage-migration.batch_size' => 1]);
$database->ready($parallel);
foreach (['a', 'b'] as $key) {
    $parallel->items()->create(['source_key' => $key, 'source_key_hash' => sha1($key), 'target_key' => $key, 'size' => 1, 'status' => StorageMigrationItemStatus::PENDING]);
}
$firstWorker = new CopyStorageMigrationItems($parallel, workerSlot: 0);
$secondWorker = new CopyStorageMigrationItems($parallel, workerSlot: 1);
$firstClaim = (new ReflectionMethod($firstWorker, 'claimBatch'))->invoke($firstWorker);
$secondClaim = (new ReflectionMethod($secondWorker, 'claimBatch'))->invoke($secondWorker);
expectMigration($firstClaim->count() === 1 && $secondClaim->count() === 1, 'Both workers must receive work.');
expectMigration($firstClaim->first()->id !== $secondClaim->first()->id, 'Workers must never claim the same file.');
expectMigration($firstClaim->first()->fresh()->status === StorageMigrationItemStatus::PROCESSING, 'A second worker must not reset another worker claim.');
expectMigration($firstClaim->first()->fresh()->worker_slot === 0 && $secondClaim->first()->fresh()->worker_slot === 1, 'Claims must track their worker slots.');
(new ReflectionMethod($secondWorker, 'settleItem'))->invoke($secondWorker, $firstClaim->first(), StorageMigrationItemStatus::COPIED, 1, 'hash');
expectMigration($parallel->fresh()->items_copied === 0, 'Workers must not settle files owned by another slot.');
(new ReflectionMethod($firstWorker, 'settleItem'))->invoke($firstWorker, $firstClaim->first(), StorageMigrationItemStatus::COPIED, 1, 'hash');
(new ReflectionMethod($firstWorker, 'settleItem'))->invoke($firstWorker, $firstClaim->first(), StorageMigrationItemStatus::COPIED, 1, 'hash');
expectMigration($parallel->fresh()->items_copied === 1 && $parallel->fresh()->bytes_copied === 1, 'Progress must update per file without counting retries twice.');
Queue::fake();
$controls->updateWorkers($parallel, ['worker_count' => 3]);
expectMigration(Queue::pushed(CopyStorageMigrationItems::class)->count() === 3, 'Saving worker count must dispatch the configured slots.');
expectMigration($parallel->fresh()->worker_count === 3, 'Worker count must be persisted per migration.');
try {
    $controls->updateWorkers($parallel, ['worker_count' => 0]);
    throw new RuntimeException('Zero workers must fail validation.');
} catch (Illuminate\Validation\ValidationException) {
}
$parallel->update(['worker_count' => 1]);
Queue::fake();
$secondWorker->handle();
expectMigration(Queue::pushed(CopyStorageMigrationItems::class)->isEmpty(), 'Disabled slots must exit without starting another job.');

$scanServer = App\Models\Server::withoutEvents(fn () => App\Models\Server::query()->create([
    'project_id' => 1, 'user_id' => 1, 'name' => 'scan-db', 'ip' => '203.0.113.10', 'os' => 'ubuntu_24', 'provider' => 'custom', 'status' => 'ready',
]));
$scanService = App\Models\Service::query()->create([
    'server_id' => $scanServer->id, 'type' => 'database', 'name' => 'mysql', 'version' => '8.4', 'status' => 'ready', 'is_default' => true,
    'type_data' => ['networking' => false],
]);
$scanRule = App\Models\FirewallRule::query()->create([
    'server_id' => $scanServer->id, 'name' => 'vito-migration-db', 'type' => 'allow', 'protocol' => 'tcp', 'port' => '3306',
    'source' => '198.51.100.20', 'mask' => 32, 'status' => FirewallRuleStatus::CREATING,
]);
$remote = StorageMigration::query()->create([
    'project_id' => 1, 'source_storage_id' => $source->id, 'target_storage_id' => $target->id, 'status' => StorageMigrationStatus::PENDING,
    'database_id' => App\Models\Database::query()->create(['server_id' => $scanServer->id, 'name' => 'scan_data', 'status' => 'ready'])->id,
    'database_user_id' => App\Models\DatabaseUser::query()->create([
        'server_id' => $scanServer->id, 'username' => 'vito_migration_test', 'password' => 'secret', 'host' => '198.51.100.20',
        'permission' => 'admin', 'status' => 'ready',
    ])->id,
    'firewall_rule_id' => $scanRule->id,
]);
Queue::fake();
(new PrepareStorageMigration($remote))->handle();
$waiting = Queue::pushed(PrepareStorageMigration::class);
expectMigration($waiting->count() === 1 && $waiting->first()->delay !== null, 'Scanning must wait until the scan database accepts remote connections.');
expectMigration($remote->fresh()->status === StorageMigrationStatus::PENDING && $remote->fresh()->started_at === null, 'A waiting scan must not start.');
$scanService->update(['type_data' => ['networking' => true]]);
expectMigration(! $database->ready($remote->fresh()), 'Scanning must wait for the firewall rule.');
$scanRule->update(['status' => FirewallRuleStatus::FAILED]);
try {
    $database->ready($remote->fresh());
    throw new LogicException('A failed firewall rule must fail the migration.');
} catch (RuntimeException $e) {
    expectMigration(str_contains($e->getMessage(), 'scan-db'), 'A failed firewall rule must fail before connecting.');
}
$connection = config('database.connections.'.$remote->fresh()->itemsConnection());
expectMigration($connection['driver'] === 'mysql' && $connection['host'] === '203.0.113.10' && (int) $connection['port'] === 3306, 'Scan data must use the selected database server.');
expectMigration($connection['database'] === 'scan_data' && $connection['username'] === 'vito_migration_test' && $connection['password'] === 'secret', 'Scan data must use the dedicated database user.');

$backup = App\Models\Backup::withoutEvents(fn () => App\Models\Backup::query()->create([
    'type' => 'file', 'server_id' => $scanServer->id, 'storage_id' => $target->id, 'path' => '/var/www', 'interval' => '0 * * * *', 'keep_backups' => 1,
]));
$backupFile = App\Models\BackupFile::withoutEvents(fn () => App\Models\BackupFile::query()->create([
    'backup_id' => $backup->id, 'name' => 'nightly', 'status' => 'created',
]));
$tracked = StorageMigration::query()->create([
    'project_id' => 1, 'source_storage_id' => $source->id, 'target_storage_id' => $target->id,
    'status' => StorageMigrationStatus::RUNNING, 'started_at' => now(),
]);
$database->ready($tracked);
$trackedItem = $tracked->items()->create([
    'backup_file_id' => $backupFile->id, 'source_key' => 'old/nightly', 'source_key_hash' => sha1('old/nightly'),
    'target_key' => 'new/nightly', 'status' => StorageMigrationItemStatus::PENDING,
]);
expectMigration($backupFile->currentStorage()->is($source) && $backupFile->currentPath() === 'old/nightly', 'Uncopied backup files must resolve to the source storage.');
$downloads = app(App\Actions\Backup\ManageBackupFile::class);
expectMigration(str_contains($downloads->downloadUrl($backupFile), '/test/old/nightly?'), 'Downloads must use the source object until it is copied.');
$trackedItem->update(['status' => StorageMigrationItemStatus::COPIED]);
expectMigration($backupFile->fresh()->activeMigrationItem() === null, 'Copied backup files must resolve to the target storage.');
$download = urldecode($downloads->downloadUrl($backupFile->fresh()));
expectMigration(str_contains($download, '/test/www/nightly.tar.gz?') && str_contains($download, 'filename="nightly.tar.gz"'), 'Downloads must sign the stored object key as an attachment.');

$controls->delete($parallel);
expectMigration(! Illuminate\Support\Facades\Schema::hasTable($parallel->itemsTable()) && $parallel->fresh()->trashed(), 'Deleting a migration must drop its scan data.');

Illuminate\Support\Facades\Event::fake([App\Events\SocketEvent::class]);
$cutoverSource = App\Models\StorageProvider::withoutEvents(fn () => App\Models\StorageProvider::query()->create([
    'user_id' => 1, 'profile' => 'Cutover source', 'provider' => 's3', 'credentials' => [...$credentials, 'path' => 'old'],
]));
$cutoverTarget = App\Models\StorageProvider::withoutEvents(fn () => App\Models\StorageProvider::query()->create([
    'user_id' => 1, 'profile' => 'Cutover target', 'provider' => 's3', 'credentials' => [...$credentials, 'path' => 'new'],
]));
$fileBackup = App\Models\Backup::withoutEvents(fn () => App\Models\Backup::query()->create([
    'type' => 'file', 'server_id' => $scanServer->id, 'storage_id' => $cutoverSource->id, 'path' => '/var/www', 'interval' => '0 * * * *', 'keep_backups' => 5,
]));
$oldFile = App\Models\BackupFile::withoutEvents(fn () => App\Models\BackupFile::query()->create([
    'backup_id' => $fileBackup->id, 'name' => 'weekly', 'status' => 'created',
]));
$orphanBackup = App\Models\Backup::withoutEvents(fn () => App\Models\Backup::query()->create([
    'type' => 'database', 'server_id' => $scanServer->id, 'storage_id' => $cutoverSource->id, 'interval' => '0 * * * *', 'keep_backups' => 5,
]));
App\Models\BackupFile::withoutEvents(fn () => App\Models\BackupFile::query()->create(['backup_id' => $orphanBackup->id, 'name' => 'orphan', 'status' => 'created']));
$clusterBackup = App\Models\Backup::withoutEvents(fn () => App\Models\Backup::query()->create([
    'type' => 'pgbackrest', 'server_id' => $scanServer->id, 'storage_id' => $cutoverSource->id, 'interval' => '0 * * * *', 'keep_backups' => 2,
    'configuration' => ['cipher_pass' => 'secret', 'strategy' => 'standard', 'process_max' => 2, 'wal_queue_max_gb' => 10],
]));
App\Models\PostgresCluster::query()->create(['project_id' => 1, 'primary_server_id' => $scanServer->id, 'backup_id' => $clusterBackup->id, 'stanza' => 'scan-db-1']);
$cutover = StorageMigration::query()->create([
    'project_id' => 1, 'source_storage_id' => $cutoverSource->id, 'target_storage_id' => $cutoverTarget->id, 'status' => StorageMigrationStatus::PENDING,
    'target_scan_completed_at' => now(),
]);
$cutoverScanner = new class($oldFile) extends S3ObjectCopier
{
    public bool $resolvedToSource = false;

    public function __construct(private App\Models\BackupFile $file) {}

    public function listPage(S3Client $client, string $bucket, string $prefix, ?string $continuationToken, int $maxKeys = 1000): array
    {
        $file = $this->file->fresh();
        $this->resolvedToSource = $file->backup->storage->profile === 'Cutover target'
            && $file->currentStorage()->profile === 'Cutover source'
            && $file->currentPath() === 'old/www/weekly.tar.gz';

        return ['objects' => [
            ['key' => 'old/www/weekly.tar.gz', 'size' => 9],
            ['key' => 'old/pgbackrest/scan-db-1/archive/scan-db-1/archive.info', 'size' => 5],
            ['key' => 'old/loose.txt', 'size' => 2],
        ], 'nextToken' => null];
    }
};
$app->instance(S3ObjectCopier::class, $cutoverScanner);
Queue::fake();
(new PrepareStorageMigration($cutover))->handle();
expectMigration($cutoverScanner->resolvedToSource, 'Known backup files must resolve to the source before the scan lists them.');
expectMigration($cutover->fresh()->status === StorageMigrationStatus::RUNNING, 'Backups without a database or with pgBackRest must not break the scan.');
expectMigration($cutover->items()->where('backup_file_id', $oldFile->id)->value('size') === 9, 'Listing a registered backup file must record its size.');
expectMigration($cutover->fresh()->items_total === 2 && $cutover->fresh()->bytes_total === 11, 'Registered files must be counted once.');
expectMigration($cutover->items()->where('source_key', 'like', 'old/pgbackrest/%')->doesntExist(), 'The live pgBackRest repository must not be copied.');
expectMigration($clusterBackup->fresh()->storage_id === $cutoverTarget->id && $clusterBackup->fresh()->status === App\Enums\BackupStatus::INSTALLING
    && Queue::pushed(App\Jobs\Backup\SetupPgBackRestJob::class)->count() === 1, 'Cut-over pgBackRest backups must be set up on the target.');

$transfers = Queue::pushed(CopyStorageMigrationItems::class);
$controls->updateWorkers($cutover, ['worker_count' => 1]);
Queue::fake();
$transfers->first()->handle();
expectMigration(Queue::pushed(CopyStorageMigrationItems::class)->isEmpty(), 'Superseded transfer workers must stop.');

try {
    $cutover->update(['status' => StorageMigrationStatus::CANCELLED]);
    $controls->delete($cutover);
    throw new LogicException('Deleting a migration with uncopied backup files must fail.');
} catch (Illuminate\Validation\ValidationException) {
    expectMigration(! $cutover->fresh()->trashed(), 'A blocked delete must keep the migration.');
}

$cutover->update(['status' => StorageMigrationStatus::FAILED, 'scan_completed_at' => null]);
Queue::fake();
$controls->retryFailed($cutover);
expectMigration($cutover->fresh()->status === StorageMigrationStatus::SCANNING && Queue::pushed(PrepareStorageMigration::class)->count() === 1, 'Retrying a migration that failed while scanning must restart discovery.');

$accessSsh = new class extends App\Helpers\SSH
{
    public string $client = '203.0.113.50 51000 22';

    public function init(App\Models\Server $server, ?string $asUser = null): self
    {
        $this->server = $server;

        return $this;
    }

    public function exec(string|Illuminate\Contracts\View\View $command, string $log = '', ?int $siteId = null, ?bool $stream = false, ?callable $streamCallback = null, int $timeout = 0): string
    {
        return str_contains((string) $command, 'SSH_CLIENT') ? $this->client : '';
    }
};
App\Facades\SSH::swap($accessSsh);
App\Models\Service::query()->create(['server_id' => $scanServer->id, 'type' => 'firewall', 'name' => 'ufw', 'version' => 'latest', 'status' => 'ready', 'is_default' => true]);
$scanService->update(['type_data' => ['networking' => true]]);
$oldRule = App\Models\FirewallRule::query()->create([
    'server_id' => $scanServer->id, 'name' => 'vito-migration-db', 'type' => 'allow', 'protocol' => 'tcp', 'port' => '3306', 'source' => '203.0.113.50', 'mask' => 32, 'status' => FirewallRuleStatus::READY,
]);
$moved = StorageMigration::query()->create([
    'project_id' => 1, 'source_storage_id' => $source->id, 'target_storage_id' => $target->id, 'status' => StorageMigrationStatus::FAILED, 'started_at' => now(),
    'database_id' => $remote->database_id, 'database_user_id' => $remote->database_user_id, 'firewall_rule_id' => $oldRule->id,
]);
Queue::fake();
expectMigration($database->refreshAccess($moved) === true && $oldRule->fresh()->source === '203.0.113.50', 'An unchanged Vito address must keep the firewall rule.');
$accessSsh->client = '198.51.100.77 52000 22';
expectMigration($database->refreshAccess($moved->fresh()) === false && $oldRule->fresh()->source === '198.51.100.77' && $oldRule->fresh()->status === FirewallRuleStatus::UPDATING,
    'When the Vito address changes, the scan database firewall rule must follow it.');

$oldRule->refresh()->update(['status' => FirewallRuleStatus::READY]);
config(["database.connections.storage-migration-{$moved->id}" => [...config('database.connections.pgsql'), 'host' => '127.0.0.1', 'port' => 1, 'database' => 'nothing', 'username' => 'nobody', 'password' => 'secret', 'options' => [PDO::ATTR_TIMEOUT => 2]]]);
try {
    $controls->delete($moved->fresh());
    throw new LogicException('Deleting a migration whose scan database is unreachable must fail with a message.');
} catch (Illuminate\Validation\ValidationException $e) {
    expectMigration(str_contains(implode(' ', $e->errors()['status'] ?? []), 'cannot reach the scan database'), 'An unreachable scan database must be explained instead of failing silently.');
}
expectMigration(! $moved->fresh()->trashed(), 'A migration must not be deleted while its scan data cannot be removed.');
$job = new PrepareStorageMigration($moved);
expectMigration((new ReflectionMethod($job, 'isTransientDatabaseError'))->invoke($job, new Illuminate\Database\QueryException('pgsql', 'select 1', [], new PDOException('SQLSTATE[08006] [7] connection to server failed: Connection refused'))), 'Losing the scan database must be retried, not fail the migration.');

$inventoried = StorageMigration::query()->create([
    'project_id' => 1, 'source_storage_id' => $source->id, 'target_storage_id' => $target->id,
    'status' => StorageMigrationStatus::PENDING, 'overwrite' => true,
]);
$lister = new class extends S3ObjectCopier
{
    public array $tokens = [];

    public function listPage(S3Client $client, string $bucket, string $prefix, ?string $continuationToken, int $maxKeys = 1000): array
    {
        $this->tokens[] = $continuationToken;

        return match (count($this->tokens)) {
            1 => ['objects' => [['key' => 'same', 'size' => 3]], 'nextToken' => 'target-two'],
            2 => ['objects' => [['key' => 'changed', 'size' => 9]], 'nextToken' => null],
            default => ['objects' => [['key' => 'same', 'size' => 3], ['key' => 'changed', 'size' => 4], ['key' => 'fresh', 'size' => 5]], 'nextToken' => null],
        };
    }
};
$app->instance(S3ObjectCopier::class, $lister);
config(['storage-migration.batch_size' => 10]);
Queue::fake();
(new PrepareStorageMigration($inventoried))->handle();
expectMigration($lister->tokens === [null, 'target-two', null], 'The target must be listed page by page before the source is scanned.');
expectMigration($inventoried->fresh()->target_scan_completed_at !== null && $inventoried->targets()->count() === 2, 'The target listing must be stored for the copy workers.');
expectMigration($inventoried->fresh()->items_total === 3 && $inventoried->fresh()->status === StorageMigrationStatus::RUNNING, 'The source scan must follow the target listing.');

$copyCalls = [];
$worker = new CopyStorageMigrationItems($inventoried->fresh());
foreach ([
    'copier' => new S3ObjectCopier,
    'sourceClient' => recordingClient($copyCalls, [new Result(['Body' => 'abcd']), new Result(['Body' => 'abcde'])]), 'sourceBucket' => 'test',
    'targetClient' => recordingClient($copyCalls, [new Result(['ETag' => '"a"']), new Result(['ETag' => '"b"'])]), 'targetBucket' => 'test',
] as $property => $value) {
    (new ReflectionProperty($worker, $property))->setValue($worker, $value);
}
invokeMigration($worker, 'runCopyCycle');
$statuses = $inventoried->items()->pluck('status', 'source_key')->map(fn (StorageMigrationItemStatus $status): string => $status->value)->all();
expectMigration($statuses === ['same' => 'skipped', 'changed' => 'copied', 'fresh' => 'copied'], 'Known target objects must be skipped or replaced by size: '.json_encode($statuses));
expectMigration($copyCalls === ['GetObject', 'PutObject', 'GetObject', 'PutObject'], 'Copying with a target listing must not send HEAD requests: '.json_encode($copyCalls));

$inventoried->update(['status' => StorageMigrationStatus::VERIFYING]);
$verifyLister = new class extends S3ObjectCopier
{
    public function listPage(S3Client $client, string $bucket, string $prefix, ?string $continuationToken, int $maxKeys = 1000): array
    {
        return ['objects' => [['key' => 'same', 'size' => 3], ['key' => 'changed', 'size' => 4]], 'nextToken' => null];
    }
};
$listing = new CopyStorageMigrationItems($inventoried->fresh(), verifyPass: 1, verifyListing: true);
foreach (['copier' => $verifyLister, 'targetClient' => migrationClient([]), 'targetBucket' => 'test'] as $property => $value) {
    (new ReflectionProperty($listing, $property))->setValue($listing, $value);
}
Queue::fake();
invokeMigration($listing, 'runVerifyCycle');
$compare = Queue::pushed(CopyStorageMigrationItems::class)->first();
expectMigration($compare !== null && ! (new ReflectionProperty($compare, 'verifyListing'))->getValue($compare), 'Verification must compare once the target listing finishes.');
expectMigration($inventoried->targets()->where('key_hash', sha1('changed'))->value('size') === 4, 'Verification must replace the old target listing.');
Queue::fake();
invokeMigration($compare, 'runVerifyCycle');
$missing = $inventoried->items()->where('source_key', 'fresh')->first();
expectMigration($missing->status === StorageMigrationItemStatus::PENDING && str_contains((string) $missing->error, 'not found on the target'), 'An object missing from the target listing must be copied again.');
expectMigration($inventoried->items()->where('source_key', 'changed')->first()->status === StorageMigrationItemStatus::COPIED, 'A verified object must stay copied.');
expectMigration($inventoried->fresh()->status === StorageMigrationStatus::RUNNING && $inventoried->fresh()->items_copied === 1, 'Repairs must reopen transfers and correct the progress.');
expectMigration(Queue::pushed(CopyStorageMigrationItems::class)->count() === 1, 'Repairs must restart a copy worker.');

$inventoried->update(['status' => StorageMigrationStatus::VERIFYING]);
$brokenLister = new class extends S3ObjectCopier
{
    public function listPage(S3Client $client, string $bucket, string $prefix, ?string $continuationToken, int $maxKeys = 1000): array
    {
        if ($continuationToken !== null) {
            throw new RuntimeException('The listing failed.');
        }

        return ['objects' => [['key' => 'same', 'size' => 3]], 'nextToken' => 'page-two'];
    }
};
$relisting = new CopyStorageMigrationItems($inventoried->fresh(), verifyPass: 2, verifyListing: true);
foreach (['copier' => $brokenLister, 'targetClient' => migrationClient([]), 'targetBucket' => 'test'] as $property => $value) {
    (new ReflectionProperty($relisting, $property))->setValue($relisting, $value);
}
try {
    invokeMigration($relisting, 'runVerifyCycle');
} catch (RuntimeException) {
}
expectMigration($inventoried->fresh()->target_scan_completed_at === null, 'Copy workers must not trust a target listing that did not finish.');

$grown = (new S3ObjectCopier(multipartThreshold: 4, partSize: 4))->copy(
    migrationClient([new Result(['Body' => 'abcd', 'ContentRange' => 'bytes 0-3/9']), new Result(['Body' => 'efgh', 'ContentRange' => 'bytes 4-7/9']), new Result(['Body' => 'i', 'ContentRange' => 'bytes 8-8/9'])]),
    'source', 'grown',
    migrationClient([new Result(['UploadId' => 'upload']), new Result(['ETag' => '"1"']), new Result(['ETag' => '"2"']), new Result(['ETag' => '"3"']), new Result(['ETag' => '"done"'])]),
    'target', 'grown', null, 5,
);
expectMigration($grown->bytes === 9, 'An object that grew after the scan must be copied whole.');

echo "Storage migration overlap, phase control, worker isolation and scan database access checks passed.\n";
