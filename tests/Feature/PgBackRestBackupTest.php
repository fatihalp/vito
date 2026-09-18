<?php

use App\Actions\Backup\CheckBackupHealth;
use App\Actions\Backup\ManageBackup;
use App\Actions\Backup\ManageBackupFile;
use App\Actions\Backup\ManagePgBackRest;
use App\Actions\Backup\RestoreBackup;
use App\Actions\Backup\RunBackup;
use App\Enums\BackupFileStatus;
use App\Enums\BackupStatus;
use App\Events\SocketEvent;
use App\Facades\SSH as SSHFacade;
use App\Helpers\SSH;
use App\Jobs\Backup\CheckPgBackRestArchivingJob;
use App\Jobs\Backup\CheckPgBackRestJob;
use App\Jobs\Backup\VerifyPgBackRestJob;
use App\Jobs\Backup\DeleteJob;
use App\Jobs\Backup\MonitorPgBackRestJob;
use App\Jobs\Backup\RunJob;
use App\Jobs\Backup\SetupPgBackRestJob;
use App\Models\Backup;
use App\Models\BackupFile;
use App\Models\Server;
use App\Models\Service;
use App\Models\StorageProvider;
use App\Notifications\BackupNeedsAttention;
use App\Notifications\BackupRecovered;
use App\Notifications\NotificationInterface;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Validation\ValidationException;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
set_exception_handler(function (Throwable $error): void {
    fwrite(STDERR, $error->getMessage()."\n");
    exit(1);
});
config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => ':memory:', 'cache.default' => 'array', 'logging.default' => 'null']);
DB::purge('sqlite');
if (DB::connection()->getConfig('database') !== ':memory:') {
    fwrite(STDERR, "Refusing to run outside an in-memory database.\n");
    exit(1);
}
Artisan::call('migrate', ['--force' => true]);
Queue::fake();
Event::fake([SocketEvent::class]);

function expectPgBackRest(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

function expectValidationError(Closure $callback, string $message): void
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

    public function init(Server $server, ?string $asUser = null): self
    {
        $this->server = $server;

        return $this;
    }

    public array $failures = [];

    public function exec(string|View $command, string $log = '', ?int $siteId = null, ?bool $stream = false, ?callable $streamCallback = null, int $timeout = 0): string
    {
        $command = (string) $command;
        $this->commands[] = $command;

        foreach ($this->failures as $needle) {
            if (str_contains($command, $needle)) {
                throw new App\Exceptions\SSHCommandError('fake failure');
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
        $this->writes[$remotePath] = ['content' => (string) $content, 'owner' => $owner];
    }

    public function ran(string $needle): bool
    {
        return collect($this->commands)->contains(fn (string $command): bool => str_contains($command, $needle));
    }
};
SSHFacade::swap($ssh);

$notifier = new class
{
    public array $sent = [];

    public bool $fail = false;

    public function send(object $notifiable, NotificationInterface $notification): void
    {
        if ($this->fail) {
            throw new RuntimeException('The notification channel is down.');
        }

        $this->sent[] = $notification;
    }
};
$app->instance('notifier', $notifier);

$server = Server::withoutEvents(fn () => Server::query()->create([
    'project_id' => 1, 'user_id' => 1, 'name' => 'App Prod', 'ip' => '203.0.113.20', 'os' => 'ubuntu_24', 'provider' => 'custom', 'status' => 'ready',
]));
Service::query()->create(['server_id' => $server->id, 'type' => 'database', 'name' => 'postgresql', 'version' => '18', 'status' => 'ready', 'is_default' => true]);
$s3 = StorageProvider::withoutEvents(fn () => StorageProvider::query()->create([
    'user_id' => 1, 'profile' => 'Backups', 'provider' => 's3',
    'credentials' => ['api_url' => 'https://fsn1.your-objectstorage.com', 'key' => 'access', 'secret' => 's3cr/et+&<x>', 'region' => 'eu-central', 'bucket' => 'db-backups', 'path' => '/prod/'],
]));
$ftp = StorageProvider::withoutEvents(fn () => StorageProvider::query()->create([
    'user_id' => 1, 'profile' => 'FTP', 'provider' => 'ftp', 'credentials' => ['host' => 'ftp.example.com'],
]));
$input = [
    'type' => 'pgbackrest', 'storage' => $s3->id, 'strategy' => 'standard', 'process_max' => '6', 'wal_queue_max_gb' => '20',
];
$custom = ['strategy' => 'custom', 'full_schedule' => '0 1 * * 0', 'diff_schedule' => '', 'incr_schedule' => '0 */6 * * *', 'retention_full' => '3', 'retention_diff' => '', 'process_max' => '8', 'wal_queue_max_gb' => '30'];

expectValidationError(fn () => app(ManageBackup::class)->create($server, [...$input, 'storage' => $ftp->id]), 'pgBackRest must require S3 storage.');
expectValidationError(fn () => app(ManageBackup::class)->create($server, [...$input, 'wal_queue_max_gb' => '0']), 'The WAL queue limit must be at least 1 GiB.');
expectValidationError(fn () => app(ManageBackup::class)->create($server, [...$input, ...$custom]), 'The custom strategy must be refused while it is turned off.');
config(['core.pgbackrest_strategies' => ['standard', 'custom']]);
expectValidationError(fn () => app(ManageBackup::class)->create($server, [...$input, ...$custom, 'full_schedule' => 'weekly']), 'A custom strategy must have a valid full backup schedule.');

$backup = app(ManageBackup::class)->create($server, $input);
$stanza = 'app-prod-'.$server->id;
expectPgBackRest($backup->status === BackupStatus::INSTALLING, 'A new pgBackRest backup must start installing.');
expectPgBackRest($backup->cluster?->stanza === $stanza && $backup->cluster->primary_server_id === $server->id && strlen($backup->configuration['cipher_pass']) === 64, 'Creating a backup must create its cluster with the stanza and a generated passphrase.');
expectPgBackRest($backup->configuration['schedules'] === ['full' => '0 2 * * 0', 'diff' => '0 2 * * 1-6', 'incr' => '0 * * * *'] && $backup->configuration['retention'] === ['full' => 4, 'diff' => 7], 'The standard strategy must schedule weekly full, daily differential and hourly incremental backups.');
expectPgBackRest(Queue::pushed(SetupPgBackRestJob::class)->count() === 1, 'Creating a backup must queue its setup.');
expectPgBackRest(! str_contains((string) DB::table('backups')->value('configuration'), $backup->configuration['cipher_pass']), 'The passphrase must be stored encrypted.');
expectValidationError(fn () => app(ManageBackup::class)->create($server, $input), 'A server must have only one pgBackRest backup.');

$ssh->responses['apt-get install -y pgbackrest'] = "Setting up pgbackrest\nVITO_PG_PATH=/var/lib/postgresql/18/main\nVITO_PG_PORT=5432\n";
Queue::fake();
app(ManagePgBackRest::class)->setup($backup);
$config = $ssh->writes['/etc/pgbackrest/pgbackrest.conf'] ?? null;
expectPgBackRest($config !== null && $config['owner'] === 'postgres', 'Setup must write the pgBackRest config as postgres.');
foreach ([
    'repo1-s3-endpoint=fsn1.your-objectstorage.com', 'repo1-s3-bucket=db-backups', 'repo1-s3-key-secret=s3cr/et+&<x>',
    "repo1-path=/prod/pgbackrest/{$stanza}", 'repo1-retention-full=4', 'repo1-retention-diff=7', 'repo1-cipher-type=aes-256-cbc',
    'repo1-cipher-pass='.$backup->configuration['cipher_pass'], 'process-max=6', 'archive-push-queue-max=20GiB',
    'compress-type=zst', "[{$stanza}]", 'pg1-path=/var/lib/postgresql/18/main', 'pg1-port=5432',
] as $line) {
    expectPgBackRest(str_contains($config['content'], $line), "The pgBackRest config must contain {$line}.");
}
expectPgBackRest(! str_contains($config['content'], 'repo1-storage-port') && ! str_contains($config['content'], '&amp;'), 'The config must not add a default port or escape secrets.');
expectPgBackRest(! str_contains($config['content'], 'tls-server') && ! str_contains($config['content'], 'pg2-host'), 'A cluster without replicas must not configure TLS.');
expectPgBackRest($ssh->ran('/etc/postgresql/18/main/conf.d') && $ssh->ran("--stanza='{$stanza}' stanza-create") && $ssh->ran('archive-push %%p'), 'Setup must enable WAL archiving and create the stanza.');
expectPgBackRest($backup->fresh()->status === null, 'A finished setup must mark the backup ready.');
$file = BackupFile::query()->where('backup_id', $backup->id)->latest('id')->first();
expectPgBackRest($file?->status === BackupFileStatus::CREATING && Queue::pushed(RunJob::class)->count() === 1, 'Setup must start the first backup.');
expectValidationError(fn () => app(RunBackup::class)->run($backup->fresh()), 'Only one pgBackRest backup may run at a time.');

Queue::fake();
app(ManagePgBackRest::class)->run($file);
expectPgBackRest($ssh->ran("--unit='vito-pgbackrest-{$file->id}'") && $ssh->ran("--type='full' backup") && ! $ssh->ran('--backup-standby'), 'The first run must start a full backup on the primary in its own systemd unit.');
expectPgBackRest($file->fresh()->server_id === $server->id && $file->fresh()->type === 'full', 'A run must record its host and type.');
expectPgBackRest(Queue::pushed(MonitorPgBackRestJob::class)->count() === 1, 'Starting a backup must queue monitoring.');
expectPgBackRest($file->fresh()->database_engine === 'postgresql' && $file->fresh()->database_version === '18', 'Backups must record the PostgreSQL version.');

$ssh->responses = [
    'systemctl show' => "LoadState=loaded\nActiveState=active\nSubState=running\nResult=success\n",
    '--output=json info' => json_encode([['name' => $stanza, 'status' => ['code' => 0, 'message' => 'ok', 'lock' => ['backup' => ['held' => true, 'size' => 1000, 'size-cplt' => 250]]], 'backup' => []]]),
];
expectPgBackRest(app(ManagePgBackRest::class)->monitor($file->fresh()) === false && $file->fresh()->status === BackupFileStatus::CREATING, 'A running backup must keep waiting.');
expectPgBackRest($file->fresh()->progress === 25.0, 'A running backup must report its progress.');

$expired = BackupFile::query()->create(['backup_id' => $backup->id, 'name' => '20260101-000000F', 'status' => BackupFileStatus::CREATED]);
$label = now()->format('Ymd-His').'F';
$info = fn (array $labels): string => json_encode([[
    'name' => $stanza,
    'status' => ['code' => 0, 'message' => 'ok'],
    'backup' => array_map(fn (string $label): array => [
        'label' => $label, 'type' => str_ends_with($label, 'F') ? 'full' : 'incr', 'error' => false,
        'timestamp' => ['start' => now()->getTimestamp(), 'stop' => now()->getTimestamp() + 60],
        'info' => ['size' => 600, 'delta' => 600, 'repository' => ['size' => 90, 'delta' => 42]],
    ], $labels),
]]);
$ssh->responses = [
    'systemctl show' => "LoadState=loaded\nActiveState=active\nSubState=exited\nResult=success\n",
    '--output=json info' => "WARN: noise\n".$info([$label]),
    'VITO_ARCHIVER=$(' => "VITO_ARCHIVER=200 100\nVITO_DROPPED=0\n",
];
expectPgBackRest(app(ManagePgBackRest::class)->monitor($file->fresh()) === true, 'A finished backup must stop monitoring.');
$file->refresh();
expectPgBackRest($file->status === BackupFileStatus::CREATED && $file->name === $label && $file->size === 42 && $file->progress === null, 'A finished backup must store its label and repository size.');
expectPgBackRest($file->database_size === 600, 'A finished backup must store the size of the database it holds.');
expectPgBackRest(BackupFile::query()->find($expired->id) === null, 'Backups expired by pgBackRest must be removed from Vito.');
expectPgBackRest($ssh->ran("reset-failed 'vito-pgbackrest-{$file->id}'"), 'A finished backup must clean up its systemd unit.');
expectPgBackRest($notifier->sent === [], 'A healthy backup must not notify.');

Queue::fake();
$incremental = app(RunBackup::class)->run($backup->fresh());
app(ManagePgBackRest::class)->run($incremental);
expectPgBackRest($ssh->ran("--type='incr' backup"), 'A run after a recent full backup must be incremental.');

$ssh->responses = [
    'systemctl show' => "LoadState=loaded\nActiveState=failed\nSubState=failed\nResult=exit-code\n",
    'journalctl' => "ERROR: [039]: HTTP request failed with 403 (Forbidden)\n",
];
app(ManagePgBackRest::class)->monitor($incremental->fresh());
expectPgBackRest($incremental->fresh()->status === BackupFileStatus::FAILED && str_contains((string) $incremental->fresh()->message, '403 (Forbidden)'), 'A failed backup must keep the pgBackRest error.');
expectPgBackRest(count($notifier->sent) === 1 && $notifier->sent[0] instanceof BackupNeedsAttention, 'A failed backup must notify.');
expectPgBackRest(str_contains(implode(' ', $backup->fresh()->health['problems']), '403 (Forbidden)'), 'The alert must carry the pgBackRest error.');

$capped = app(RunBackup::class)->run($backup->fresh());
$ssh->responses = [
    'systemctl show' => "LoadState=loaded\nActiveState=failed\nSubState=failed\nResult=exit-code\n",
    'journalctl' => "P00  ERROR: [039]: unable to load info file '/pgbackrest/backup.info':\n    x-amz-request-id: cef69ee088ab2efe\n    <Error>\n        <Code>AccessDenied</Code>\n        <Message>Cannot download file, download bandwidth or transaction (Class B) cap exceeded. See the Caps &amp; Alerts page to increase your cap.</Message>\n    </Error>\n    HINT: backup.info cannot be opened and is required to perform a backup.\n",
];
app(ManagePgBackRest::class)->monitor($capped->fresh());
$reason = (string) $capped->fresh()->message;
expectPgBackRest(str_contains($reason, 'Class B) cap exceeded. See the Caps & Alerts page') && str_starts_with($reason, 'P00  ERROR: [039]') && ! str_contains($reason, 'x-amz-request-id'), 'A failed backup must keep the error and the storage message, not HTTP headers: '.$reason);

$lost = app(RunBackup::class)->run($backup->fresh());
$ssh->responses = [
    'systemctl show' => "LoadState=not-found\nActiveState=inactive\nSubState=dead\nResult=success\n",
    '--output=json info' => $info([$label]),
    'VITO_ARCHIVER=$(' => "VITO_ARCHIVER=200 100\nVITO_DROPPED=0\n",
];
app(ManagePgBackRest::class)->monitor($lost->fresh());
expectPgBackRest($lost->fresh()->status === BackupFileStatus::FAILED && str_contains((string) $lost->fresh()->message, 'stopped before it finished'), 'A lost backup process must fail clearly.');
expectPgBackRest(count($notifier->sent) === 1, 'Backups that keep failing must not alert on every run.');

$notifier->sent = [];
$warned = app(RunBackup::class)->run($backup->fresh());
$nextLabel = $label.'_'.now()->addSecond()->format('Ymd-His').'I';
$ssh->responses = [
    'systemctl show' => "LoadState=loaded\nActiveState=active\nSubState=exited\nResult=success\n",
    '--output=json info' => $info([$label, $nextLabel]),
    'VITO_ARCHIVER=$(' => "VITO_ARCHIVER=100 300\nVITO_DROPPED=3\n",
];
app(ManagePgBackRest::class)->monitor($warned->fresh());
expectPgBackRest($warned->fresh()->status === BackupFileStatus::CREATED && str_contains((string) $warned->fresh()->message, 'dropped WAL') && str_contains((string) $warned->fresh()->message, 'failing to archive'), 'Archiving problems must be recorded on the backup.');
expectPgBackRest(count($notifier->sent) === 1 && $notifier->sent[0] instanceof BackupNeedsAttention, 'Archiving problems must notify.');
expectPgBackRest(array_keys($backup->fresh()->health['problems']) === ['archiving', 'wal_gap'], 'Archiving problems must replace the fixed failure: '.json_encode($backup->fresh()->health));
expectPgBackRest($backup->fresh()->configuration['dropped_wal'] === 3, 'The dropped WAL count must be remembered.');

$notifier->sent = [];
$ssh->responses = ['VITO_ARCHIVER=$(' => "VITO_ARCHIVER=100 300\nVITO_DROPPED=3\n"];
(new CheckPgBackRestArchivingJob($backup->fresh()))->handle();
expectPgBackRest($notifier->sent === [], 'An ongoing archiving problem must not notify again.');
$ssh->responses = ['VITO_ARCHIVER=$(' => "VITO_ARCHIVER=400 300\nVITO_DROPPED=3\n"];
(new CheckPgBackRestArchivingJob($backup->fresh()))->handle();
expectPgBackRest(array_keys($backup->fresh()->health['problems']) === ['wal_gap'] && $notifier->sent === [], 'Recovered archiving must clear quietly while the WAL gap remains.');
$ssh->responses = ['VITO_ARCHIVER=$(' => "VITO_ARCHIVER=400 500\nVITO_DROPPED=3\n"];
(new CheckPgBackRestArchivingJob($backup->fresh()))->handle();
expectPgBackRest(count($notifier->sent) === 1 && $notifier->sent[0] instanceof BackupNeedsAttention, 'Archiving that fails again must notify again.');
expectPgBackRest($server->getWarnings() === [['key' => 'backups_need_attention', 'count' => 1]], 'The server must warn about backups that need attention.');

$notifier->sent = [];
Carbon::setTestNow(now()->addMinute());
$healthy = app(RunBackup::class)->run($backup->fresh());
$ssh->responses = [
    'systemctl show' => "LoadState=loaded\nActiveState=active\nSubState=exited\nResult=success\n",
    '--output=json info' => $info([$label, $nextLabel, $label.'_'.now()->format('Ymd-His').'I']),
    'VITO_ARCHIVER=$(' => "VITO_ARCHIVER=600 500\nVITO_DROPPED=3\n",
];
app(ManagePgBackRest::class)->monitor($healthy->fresh());
Carbon::setTestNow();
expectPgBackRest($healthy->fresh()->status === BackupFileStatus::CREATED && $backup->fresh()->health === null, 'A clean backup after the WAL gap must clear every problem.');
expectPgBackRest(count($notifier->sent) === 1 && $notifier->sent[0] instanceof BackupRecovered, 'Recovery must notify once.');
expectPgBackRest($server->getWarnings() === [], 'A healthy backup must not warn on the server.');

Queue::fake();
Artisan::call('backups:check-archiving');
expectPgBackRest(Queue::pushed(CheckPgBackRestArchivingJob::class)->count() === 1, 'The periodic check must queue one check per ready pgBackRest backup.');

Queue::fake();
app(ManagePgBackRest::class)->storageChanged($s3->fresh());
expectPgBackRest($backup->fresh()->status === BackupStatus::INSTALLING && Queue::pushed(SetupPgBackRestJob::class)->count() === 1, 'Changing storage credentials must reapply the pgBackRest setup.');
$ssh->responses = ['apt-get install -y pgbackrest' => "VITO_PG_PATH=/var/lib/postgresql/18/main\nVITO_PG_PORT=5432\n"];
Queue::fake();
app(ManagePgBackRest::class)->setup($backup->fresh());
expectPgBackRest($backup->fresh()->status === null && Queue::pushed(RunJob::class)->isEmpty(), 'Reapplying setup must not start a backup when backups already exist.');

app(ManageBackup::class)->update($backup->fresh(), $custom);
$config = $ssh->writes['/etc/pgbackrest/pgbackrest.conf']['content'];
expectPgBackRest(str_contains($config, 'repo1-retention-full=3') && ! str_contains($config, 'repo1-retention-diff') && str_contains($config, 'process-max=8') && str_contains($config, 'archive-push-queue-max=30GiB'), 'Editing must rewrite the pgBackRest config.');
expectPgBackRest($backup->fresh()->configuration['schedules'] === ['full' => '0 1 * * 0', 'diff' => null, 'incr' => '0 */6 * * *'], 'A custom strategy must store its schedules.');
expectPgBackRest($backup->fresh()->configuration['cipher_pass'] === $backup->configuration['cipher_pass'], 'Editing must keep the passphrase.');

expectValidationError(fn () => app(RestoreBackup::class)->restore($file->fresh(), []), 'pgBackRest backups must not use the database restore flow.');
expectValidationError(fn () => app(ManageBackupFile::class)->downloadUrl($file->fresh()), 'pgBackRest backups must not offer a single-file download.');

Backup::query()->whereKey($backup->id)->update(['status' => BackupStatus::FAILED->value]);
Queue::fake();
app(ManageBackup::class)->update($backup->fresh(), $custom);
expectPgBackRest($backup->fresh()->status === BackupStatus::INSTALLING && Queue::pushed(SetupPgBackRestJob::class)->count() === 1, 'Saving a failed backup must retry setup.');

Backup::query()->whereKey($backup->id)->update(['status' => BackupStatus::INSTALLING->value, 'updated_at' => now()->subDay()]);
Artisan::call('backups:reconcile');
expectPgBackRest($backup->fresh()->status === BackupStatus::FAILED, 'A stuck setup must be marked failed.');

Backup::query()->whereKey($backup->id)->update(['status' => null]);
app(ManageBackup::class)->update($backup->fresh(), $input);
BackupFile::query()->where('backup_id', $backup->id)->where('status', BackupFileStatus::CREATING)->update(['status' => BackupFileStatus::FAILED]);

Carbon::setTestNow(Carbon::parse('next sunday 02:00', config('app.timezone')));
Queue::fake();
Artisan::call('backups:run');
$scheduled = BackupFile::query()->where('backup_id', $backup->id)->latest('id')->first();
expectPgBackRest($scheduled->type === 'full' && $scheduled->status === BackupFileStatus::CREATING && Queue::pushed(RunJob::class)->count() === 1, 'Sunday 02:00 must start the weekly full backup, not the hourly incremental.');

Carbon::setTestNow(now()->setTime(3, 0));
Queue::fake();
Artisan::call('backups:run');
expectPgBackRest(Queue::pushed(RunJob::class)->isEmpty() && $backup->fresh()->configuration['queued_type'] === 'incr', 'A due backup must wait for the running one.');
Carbon::setTestNow(now()->addDay()->setTime(2, 0));
Queue::fake();
Artisan::call('backups:run');
expectPgBackRest($backup->fresh()->configuration['queued_type'] === 'diff', 'A waiting incremental must be upgraded to the due differential.');

$ssh->responses = [
    'systemctl show' => "LoadState=loaded\nActiveState=failed\nSubState=failed\nResult=exit-code\n",
    'journalctl' => "ERROR: interrupted\n",
];
Queue::fake();
app(ManagePgBackRest::class)->monitor($scheduled->fresh());
$queued = BackupFile::query()->where('backup_id', $backup->id)->latest('id')->first();
expectPgBackRest($queued->id !== $scheduled->id && $queued->type === 'diff' && $backup->fresh()->configuration['queued_type'] === null, 'The queued backup must start when the running one ends.');
BackupFile::query()->whereKey($queued->id)->update(['status' => BackupFileStatus::FAILED]);

Carbon::setTestNow(now()->next('Saturday')->setTime(4, 0));
Queue::fake();
Artisan::call('backups:run');
expectPgBackRest(Queue::pushed(VerifyPgBackRestJob::class)->count() === 1, 'The weekly verification must be queued on schedule.');
Carbon::setTestNow(now()->addDay()->setTime(3, 30));
Queue::fake();
Artisan::call('backups:run');
expectPgBackRest(Queue::pushed(CheckPgBackRestJob::class)->count() === 1, 'The daily pgbackrest check must be queued on schedule.');

Carbon::setTestNow(now()->setTime(9, 17));
BackupFile::query()->where('backup_id', $backup->id)->where('status', BackupFileStatus::CREATING)->update(['status' => BackupFileStatus::FAILED]);
Queue::fake();
Artisan::call('backups:run');
$caughtUp = BackupFile::query()->where('backup_id', $backup->id)->latest('id')->first();
expectPgBackRest($caughtUp->type === 'full' && $caughtUp->created_at->eq(now()) && Queue::pushed(RunJob::class)->count() === 1, 'A full backup missed while Vito was down must start when it is back.');
Carbon::setTestNow(now()->addMinute());
BackupFile::query()->whereKey($caughtUp->id)->update(['status' => BackupFileStatus::CREATED]);
Queue::fake();
Artisan::call('backups:run');
expectPgBackRest(Queue::pushed(RunJob::class)->isEmpty() && Queue::pushed(CheckPgBackRestJob::class)->isEmpty() && Queue::pushed(VerifyPgBackRestJob::class)->isEmpty(), 'A caught-up run must start only once.');
Carbon::setTestNow(now()->addHours(3)->setTime(12, 5));
Queue::fake();
Artisan::call('backups:run');
expectPgBackRest(BackupFile::query()->where('backup_id', $backup->id)->latest('id')->value('type') === 'incr' && Queue::pushed(RunJob::class)->count() === 1, 'Missed hourly runs must catch up as one incremental.');
BackupFile::query()->where('backup_id', $backup->id)->where('status', BackupFileStatus::CREATING)->update(['status' => BackupFileStatus::CREATED]);
Carbon::setTestNow();

$ssh->commands = [];
app(ManagePgBackRest::class)->startVerify($backup->fresh());
expectPgBackRest($ssh->ran("--unit='vito-pgbackrest-verify-{$backup->id}'") && $ssh->ran("--stanza='{$stanza}' verify"), 'Verification must run pgbackrest verify in its own unit.');
$notifier->sent = [];
$ssh->responses = ['systemctl show' => "LoadState=loaded\nActiveState=active\nSubState=running\nResult=success\n"];
expectPgBackRest(app(ManagePgBackRest::class)->monitorVerify($backup->fresh()) === false, 'A running verification must keep waiting.');
$ssh->responses = ['systemctl show' => "LoadState=loaded\nActiveState=failed\nSubState=failed\nResult=exit-code\n", 'journalctl' => "ERROR: [028]: invalid checksum\n"];
app(ManagePgBackRest::class)->monitorVerify($backup->fresh());
expectPgBackRest($backup->fresh()->configuration['last_verify_result'] === 'failed' && ! isset($backup->fresh()->configuration['verify']), 'A failed verification must be recorded.');
expectPgBackRest(count($notifier->sent) === 1 && $notifier->sent[0] instanceof BackupNeedsAttention && str_contains(implode(' ', $backup->fresh()->health['problems']), 'invalid checksum'), 'A failed verification must notify with its error.');

$notifier->sent = [];
$ssh->failures = ["' check"];
app(ManagePgBackRest::class)->runCheck($backup->fresh());
expectPgBackRest($backup->fresh()->configuration['last_check_result'] === 'failed' && count($notifier->sent) === 1 && $notifier->sent[0] instanceof BackupNeedsAttention, 'A failed pgbackrest check must notify.');
$ssh->failures = [];

$fileBackup = Backup::withoutEvents(fn () => Backup::query()->create([
    'type' => 'file', 'server_id' => $server->id, 'storage_id' => $s3->id, 'path' => '/var/www', 'interval' => '0 * * * *', 'keep_backups' => 3,
]));
Backup::query()->whereKey($fileBackup->id)->update(['created_at' => now()->subHours(3)]);
$notifier->sent = [];
$health = app(CheckBackupHealth::class);
$notifier->fail = true;
$health->check($fileBackup);
expectPgBackRest($fileBackup->fresh()->health === null, 'An alert that could not be sent must be sent by the next check.');
$notifier->fail = false;
$health->check($fileBackup);
expectPgBackRest(array_keys($fileBackup->fresh()->health['problems']) === ['overdue'] && $notifier->sent[0] instanceof BackupNeedsAttention, 'A backup that never ran on schedule must be overdue.');
$health->check($fileBackup);
expectPgBackRest(count($notifier->sent) === 1, 'An ongoing problem must not alert on every check.');
Carbon::setTestNow(now()->addHours(25));
$health->check($fileBackup);
Carbon::setTestNow();
expectPgBackRest(count($notifier->sent) === 2, 'A problem that lasts must send a daily reminder.');
$running = BackupFile::withoutEvents(fn () => BackupFile::query()->create(['backup_id' => $fileBackup->id, 'name' => 'www', 'status' => BackupFileStatus::CREATING]));
expectPgBackRest($health->problems($fileBackup->fresh()) === [], 'A running backup must not be overdue.');
BackupFile::query()->whereKey($running->id)->update(['status' => BackupFileStatus::CREATED]);
$health->check($fileBackup);
expectPgBackRest($fileBackup->fresh()->health === null && $notifier->sent[2] instanceof BackupRecovered, 'A finished backup must end the overdue alert.');
Backup::query()->whereKey($fileBackup->id)->update(['enabled' => false, 'health' => json_encode(['problems' => ['overdue' => 'x'], 'since' => now()->toIso8601String(), 'notified_at' => now()->toIso8601String()])]);
$health->check($fileBackup);
expectPgBackRest($fileBackup->fresh()->health === null && count($notifier->sent) === 3, 'Disabling a backup must clear its alerts quietly.');
Artisan::call('backups:check-health');
expectPgBackRest(str_contains(Artisan::output(), 'backups checked'), 'The periodic health check must run.');

$impossible = Backup::withoutEvents(fn () => Backup::query()->create([
    'type' => 'file', 'server_id' => $server->id, 'storage_id' => $s3->id, 'path' => '/srv/leap', 'interval' => '0 0 30 2 *', 'keep_backups' => 1,
]));
$hourly = Backup::withoutEvents(fn () => Backup::query()->create([
    'type' => 'file', 'server_id' => $server->id, 'storage_id' => $s3->id, 'path' => '/srv/app', 'interval' => '0 * * * *', 'keep_backups' => 1,
]));
Backup::query()->whereKey($hourly->id)->update(['created_at' => now()->subHours(3)]);
Queue::fake();
Artisan::call('backups:run');
expectPgBackRest(Backup::lastDue('0 0 30 2 *', now()) === null && BackupFile::query()->where('backup_id', $impossible->id)->doesntExist(), 'An impossible schedule must be ignored.');
expectPgBackRest(BackupFile::query()->where('backup_id', $hourly->id)->count() === 1, 'An impossible schedule must not stop later backups, and a missed file backup must catch up.');
Artisan::call('backups:run');
expectPgBackRest(BackupFile::query()->where('backup_id', $hourly->id)->count() === 1, 'A caught-up file backup must start only once.');

$notifier->sent = [];
Backup::query()->whereKey($hourly->id)->update(['status' => BackupStatus::INSTALLING->value, 'health' => json_encode(['problems' => ['failed' => 'x'], 'since' => now()->toIso8601String(), 'notified_at' => now()->toIso8601String()])]);
$health->check($hourly);
expectPgBackRest($notifier->sent === [] && $hourly->fresh()->health !== null, 'Reinstalling a backup must not report it as recovered.');

BackupFile::query()->where('backup_id', $backup->id)->where('status', BackupFileStatus::CREATING)->update(['status' => BackupFileStatus::FAILED]);
Backup::query()->whereKey($backup->id)->update(['enabled' => false]);
Queue::fake();
app(ManagePgBackRest::class)->queue($backup->fresh(), 'full');
expectPgBackRest(Queue::pushed(RunJob::class)->isEmpty() && $backup->fresh()->configuration['queued_type'] === 'full', 'A disabled backup must keep queued runs until it is enabled again.');
Backup::query()->whereKey($backup->id)->update(['enabled' => true, 'created_at' => now()->subDays(5)]);

$verifying = $backup->fresh();
$verifying->configuration = [...$verifying->configuration, 'queued_type' => null, 'verify' => ['server_id' => $server->id, 'started_at' => now()->subHours(2)->toIso8601String()]];
$verifying->save();
$ssh->commands = [];
Queue::fake();
(new VerifyPgBackRestJob($backup->fresh()))->handle();
expectPgBackRest(! $ssh->ran('verify'), 'A verification that is still running must not be started again.');
$verifying->refresh()->configuration = [...$verifying->configuration, 'verify' => ['server_id' => $server->id, 'started_at' => now()->subDays(2)->toIso8601String()]];
$verifying->save();
(new VerifyPgBackRestJob($backup->fresh()))->handle();
expectPgBackRest($ssh->ran("stop 'vito-pgbackrest-verify-{$backup->id}'") && $ssh->ran('verify'), 'A verification stuck for a day must be replaced by a new one.');
$ssh->failures = ['systemctl show'];
Queue::fake();
(new VerifyPgBackRestJob($backup->fresh(), true))->handle();
$retry = Queue::pushed(VerifyPgBackRestJob::class)->first();
expectPgBackRest($retry !== null && (new ReflectionProperty($retry, 'errors'))->getValue($retry) === 1 && isset($backup->fresh()->configuration['verify']), 'An SSH error while watching a verification must be retried, not reported as a failed verification.');
$ssh->failures = [];

$checking = $backup->fresh();
$checking->configuration = [...$checking->configuration, 'last_checked_at' => now()->subDays(3)->toIso8601String(), 'last_check_result' => 'passed', 'check_requested_at' => now()->subMinutes(5)->toIso8601String()];
$checking->save();
expectPgBackRest(! array_key_exists('check_overdue', $health->problems($backup->fresh())), 'A check that was just requested must not be reported as overdue.');
$checking->refresh()->configuration = [...$checking->configuration, 'check_requested_at' => now()->subHours(3)->toIso8601String()];
$checking->save();
expectPgBackRest(array_key_exists('check_overdue', $health->problems($backup->fresh())), 'A requested check that never ran must be reported.');

Illuminate\Support\Facades\Storage::fake(config('core.key_pairs_disk'));
$hetzner = App\Models\ServerProvider::withoutEvents(fn () => App\Models\ServerProvider::query()->create([
    'user_id' => 1, 'project_id' => 1, 'profile' => 'hetzner', 'provider' => 'hetzner', 'credentials' => ['token' => 'secret-token'], 'connected' => true,
]));
$serverTypes = collect([['cax11', 2, 4, 40, 'arm'], ['cax01', 1, 2, 10, 'arm'], ['cx22', 2, 4, 40, 'x86']])->map(fn (array $type): array => [
    'name' => $type[0], 'cores' => $type[1], 'memory' => $type[2], 'disk' => $type[3], 'architecture' => $type[4],
    'locations' => [['name' => 'nbg1', 'available' => true]], 'prices' => [],
])->all();
Illuminate\Support\Facades\Http::fake(function (Illuminate\Http\Client\Request $request) use ($serverTypes) {
    $path = parse_url($request->url(), PHP_URL_PATH);

    return match (true) {
        $path === '/v1/server_types' => Illuminate\Support\Facades\Http::response(['server_types' => $serverTypes]),
        $path === '/v1/ssh_keys' && $request->method() === 'GET' => Illuminate\Support\Facades\Http::response(['ssh_keys' => []]),
        $path === '/v1/ssh_keys' => Illuminate\Support\Facades\Http::response(['ssh_key' => ['id' => 9]], 201),
        $path === '/v1/servers' => Illuminate\Support\Facades\Http::response(['server' => ['id' => 555, 'public_net' => ['ipv4' => ['ip' => '198.51.100.99']]]], 201),
    };
});
$server->update(['provider' => 'hetzner', 'provider_id' => $hetzner->id, 'provider_data' => ['plan' => 'cax11', 'region' => 'nbg1', 'hetzner_id' => 1]]);
App\Models\Metric::query()->create(['server_id' => $server->id, 'load' => 0.1, 'cpu_cores' => 2, 'memory_total' => 3897096, 'memory_used' => 1000000, 'memory_free' => 2897096, 'disk_total' => 38106, 'disk_used' => 3526, 'disk_free' => 34580]);
$restorable = BackupFile::withoutEvents(fn () => BackupFile::query()->create([
    'backup_id' => $backup->id, 'name' => '20260917-160640F', 'status' => BackupFileStatus::CREATED, 'type' => 'full', 'database_size' => 20 * 1073741824,
]));
BackupFile::query()->whereKey($restorable->id)->update(['database_version' => '18']);
$restores = app(App\Actions\Backup\RestoreToNewServer::class);
$needs = $restores->requirements($backup->fresh());
expectPgBackRest($needs['storage_gb'] === 36 && $needs['cores'] === 2 && (float) $needs['memory_gb'] === 4.0 && $needs['architecture'] === 'arm' && $needs['os'] === 'ubuntu_24' && $needs['postgresql'] === '18',
    'Restore requirements must come from the largest database and the source plan: '.json_encode($needs));
$restoreInput = ['name' => 'restored-db', 'server_provider' => $hetzner->id, 'region' => 'nbg1', 'plan' => 'cax11', 'target' => 'latest'];
$user = App\Models\User::factory()->create(['is_admin' => true]);
App\Models\Project::query()->find($server->project_id) ?? App\Models\Project::query()->forceCreate(['id' => $server->project_id, 'name' => 'Production']);
expectValidationError(fn () => $restores->create($user, $backup->fresh(), [...$restoreInput, 'plan' => 'cax01']), 'A plan without enough disk must be refused.');
expectValidationError(fn () => $restores->create($user, $backup->fresh(), [...$restoreInput, 'plan' => 'cx22']), 'A plan on another processor architecture must be refused.');
expectValidationError(fn () => $restores->create($user, $backup->fresh(), [...$restoreInput, 'target' => 'time', 'target_time' => '2001-01-01 00:00:00']), 'A point in time before the oldest backup must be refused.');
Queue::fake();
$restore = $restores->create($user, $backup->fresh(), $restoreInput);
$restored = $restore->server;
expectPgBackRest($restored->provider === 'hetzner' && $restored->os->value === 'ubuntu_24' && $restored->database()?->version === '18' && $restored->services()->where('name', 'ufw')->doesntExist(), 'The new server must match the source OS and PostgreSQL version, without requiring a firewall.');
expectPgBackRest($restore->status === App\Enums\BackupRestoreStatus::WAITING_FOR_SERVER && Queue::pushed(App\Jobs\Backup\RestoreToNewServerJob::class)->count() === 1, 'The restore must wait for the new server.');

Queue::fake();
(new App\Jobs\Backup\RestoreToNewServerJob($restore))->handle();
expectPgBackRest($restore->fresh()->status === App\Enums\BackupRestoreStatus::WAITING_FOR_SERVER && Queue::pushed(App\Jobs\Backup\RestoreToNewServerJob::class)->count() === 1, 'The restore must keep waiting while the server installs.');
$restored->update(['status' => 'ready']);
$ssh->commands = [];
$ssh->writes = [];
$ssh->responses = ['SHOW data_directory' => "VITO_DATA_DIRECTORY=/var/lib/postgresql/18/main\nVITO_PORT=5432\nVITO_VERSION_NUM=180003\n"];
(new App\Jobs\Backup\RestoreToNewServerJob($restore))->handle();
$script = collect($ssh->commands)->first(fn (string $command): bool => str_contains($command, 'vito-pgbackrest-restore-'.$restore->id));
expectPgBackRest($restore->fresh()->status === App\Enums\BackupRestoreStatus::RESTORING && $script !== null, 'A ready server must start the restore.');
expectPgBackRest(str_contains($script, "--archive-mode=off  restore") && ! str_contains($script, '--type=') && str_contains($script, 'find "$PGDATA" -mindepth 1 -delete'), 'The latest restore must replay all WAL without archiving.');
expectPgBackRest(str_contains($script, "'ALTER SYSTEM RESET archive_mode'") && str_contains($script, 'rm -f /etc/pgbackrest/pgbackrest.conf'), 'The restored server must not keep archiving settings or repository credentials.');
expectPgBackRest(str_contains($script, "WHERE rolname LIKE 'vito\\\\_replica\\\\_%' LOOP EXECUTE format('DROP ROLE %I'"), 'The restored server must not keep the replication logins of the source cluster.');
expectPgBackRest(str_contains($script, "'/usr/lib/postgresql/18/bin/pg_controldata'") && str_contains($script, 'max_prepared_transactions:max_prepared_xacts') && str_contains($script, "'/etc/postgresql/18/main/conf.d/zz-vito-restore.conf'"),
    'A restore must start PostgreSQL with max_connections and the other recovery settings of the source cluster.');
expectPgBackRest(str_contains($script, 'is a lower setting than on the primary server, where its value was') && str_contains($script, 'systemctl restart "$SERVICE"'), 'A restore must raise a setting the WAL needs and restart instead of failing.');
expectPgBackRest(str_contains($ssh->writes['/etc/pgbackrest/pgbackrest.conf']['content'] ?? '', 'pg1-path=/var/lib/postgresql/18/main'), 'The new server must get a pgBackRest config for its own data directory.');

$ssh->responses = ['systemctl show' => "LoadState=loaded\nActiveState=active\nSubState=running\nResult=success\n", 'journalctl' => 'P00   INFO: restore file /var/lib/postgresql/18/main/base/1/1259'];
(new App\Jobs\Backup\RestoreToNewServerJob($restore))->handle();
expectPgBackRest(str_contains((string) $restore->fresh()->step, 'restore file'), 'A running restore must show its latest output line.');
$notifier->sent = [];
$ssh->responses = ['systemctl show' => "LoadState=loaded\nActiveState=active\nSubState=exited\nResult=success\n"];
Queue::fake();
(new App\Jobs\Backup\RestoreToNewServerJob($restore))->handle();
expectPgBackRest($restore->fresh()->status === App\Enums\BackupRestoreStatus::COMPLETED && $restore->fresh()->finished_at !== null && Queue::pushed(App\Jobs\Backup\RestoreToNewServerJob::class)->isEmpty(), 'A finished restore must complete.');
expectPgBackRest($notifier->sent[0] instanceof App\Notifications\BackupRestoreFinished, 'A finished restore must notify.');

App\Models\BackupRestore::query()->whereKey($restore->id)->update(['status' => 'restoring', 'updated_at' => now()->subHour()]);
Queue::fake();
Artisan::call('backups:reconcile');
expectPgBackRest(Queue::pushed(App\Jobs\Backup\RestoreToNewServerJob::class)->count() === 1, 'A restore Vito stopped watching must be watched again.');
App\Models\BackupRestore::query()->whereKey($restore->id)->update(['status' => 'completed']);

$ssh->responses = ['SHOW data_directory' => "VITO_DATA_DIRECTORY=/var/lib/postgresql/18/main\nVITO_PORT=5432\nVITO_VERSION_NUM=180003\n"];
$ssh->commands = [];
BackupFile::query()->where('backup_id', $backup->id)->update(['created_at' => now()->subDays(2)]);
$pointInTime = $restores->create($user, $backup->fresh(), [...$restoreInput, 'name' => 'restored-pitr', 'target' => 'time', 'target_time' => now()->subMinutes(5)->toIso8601String()]);
$pointInTime->server->update(['status' => 'ready']);
(new App\Jobs\Backup\RestoreToNewServerJob($pointInTime))->handle();
$script = collect($ssh->commands)->first(fn (string $command): bool => str_contains($command, 'vito-pgbackrest-restore-'.$pointInTime->id));
expectPgBackRest(str_contains((string) $script, "--type=time --target='".$pointInTime->fresh()->target_time->utc()->format('Y-m-d H:i:sP')."' --target-action=promote"), 'A point-in-time restore must stop at the chosen time.');
$ssh->responses = ['systemctl show' => "LoadState=loaded\nActiveState=failed\nSubState=failed\nResult=exit-code\n", 'journalctl' => "FATAL:  recovery ended before configured recovery target was reached\n"];
$notifier->sent = [];
(new App\Jobs\Backup\RestoreToNewServerJob($pointInTime))->handle();
expectPgBackRest($pointInTime->fresh()->status === App\Enums\BackupRestoreStatus::FAILED && str_contains((string) $pointInTime->fresh()->message, 'recovery target') && $ssh->ran('sudo rm -f /etc/pgbackrest/pgbackrest.conf'), 'A failed restore must keep the error and remove the repository credentials.');
expectPgBackRest($notifier->sent[0] instanceof App\Notifications\BackupRestoreFinished, 'A failed restore must notify.');

BackupFile::query()->create(['backup_id' => $backup->id, 'name' => $stanza, 'status' => BackupFileStatus::CREATING]);

$ssh->commands = [];
(new DeleteJob($backup->fresh()))->handle();
expectPgBackRest($ssh->ran("archive_mode = off\\narchive_command = '/bin/true'"), 'Deleting must turn off WAL archiving on the server.');
expectPgBackRest(! $ssh->ran('aws s3') && ! $ssh->ran('stanza-delete'), 'Deleting must keep the backups in S3.');
expectPgBackRest(Backup::query()->find($backup->id) === null && BackupFile::query()->where('backup_id', $backup->id)->doesntExist(), 'Deleting must remove the backup from Vito.');

echo "pgBackRest setup, strategy scheduling, verification, monitoring, retention, alerting, backup health and deletion checks passed.\n";
