<?php

namespace App\SSH;

use App\Actions\PostgresCluster\IssueClusterCertificates;
use App\Exceptions\SSHCommandError;
use App\Models\Backup;
use App\Models\BackupFile;
use App\Models\DatabaseReplica;
use App\Models\PostgresCluster;
use App\Models\Server;
use App\StorageProviders\S3;

class PgBackRest
{
    public const TLS_PORT = 8432;

    private const TLS_DIRECTORY = '/etc/pgbackrest/tls';

    public function __construct(protected Backup $backup) {}

    public function install(): array
    {
        $output = $this->backup->server->ssh()->exec(view('ssh.pgbackrest.prepare'), 'pgbackrest-install');

        if (preg_match('/^VITO_PG_PATH=(\S+)$/m', $output, $path) !== 1 || preg_match('/^VITO_PG_PORT=(\d+)$/m', $output, $port) !== 1) {
            throw new SSHCommandError('Could not read the PostgreSQL data directory and port.');
        }

        return ['pg_path' => $path[1], 'pg_port' => (int) $port[1]];
    }

    public function writeConfig(?Server $server = null, ?string $pgPath = null, ?int $pgPort = null): void
    {
        $server ??= $this->backup->server;

        $server->ssh()->exec('sudo install -d -m 755 /etc/pgbackrest', 'pgbackrest-config');
        self::ensureFile($server, '/etc/pgbackrest/pgbackrest.conf', '640');
        $server->ssh()->write('/etc/pgbackrest/pgbackrest.conf', $this->config($server, $pgPath, $pgPort), 'postgres', 'pgbackrest-config');
    }

    /**
     * Creates the file owned by postgres with the given mode unless it exists, so secrets written into it are never readable by other users.
     */
    public static function ensureFile(Server $server, string $path, string $mode): void
    {
        $file = escapeshellarg($path);

        $server->ssh()->exec(
            "sudo test -f {$file} || sudo install -m {$mode} -o postgres -g postgres /dev/null {$file}; sudo chown postgres:postgres {$file}; sudo chmod {$mode} {$file}",
            'prepare-secret-file'
        );
    }

    public function writeConfigs(): void
    {
        foreach ($this->cluster()->streamingReplicas() as $replica) {
            if (isset($replica->configuration['replica']['data_directory'])) {
                $this->writeConfig($replica->replica);
            }
        }

        $this->writeConfig();
    }

    public function config(Server $server, ?string $pgPath = null, ?int $pgPort = null): string
    {
        $storage = $this->backup->storage;
        $credentials = $storage->credentials;
        $endpoint = parse_url((new S3($storage))->getApiUrl());
        $configuration = $this->backup->configuration;
        $cluster = $this->cluster();
        $isPrimary = $server->id === $cluster->primary_server_id;
        $replica = $isPrimary ? null : $cluster->replicas()->where('replica_server_id', $server->id)->first();
        $tls = $cluster->tls !== null && isset($cluster->tls['nodes'][$server->id]);
        $clients = $isPrimary && $tls ? $cluster->streamingReplicas()
            ->map(fn (DatabaseReplica $replica): string => PostgresCluster::hostAlias($replica->replica))
            ->values()
            ->all() : [];

        return view('ssh.pgbackrest.config', [
            'bucket' => $credentials['bucket'],
            'endpoint' => $endpoint['host'] ?? '',
            'port' => $endpoint['port'] ?? null,
            'region' => $credentials['region'],
            'key' => $credentials['key'],
            'secret' => $credentials['secret'],
            'repoPath' => '/'.implode('/', array_filter([trim((string) ($credentials['path'] ?? ''), '/'), 'pgbackrest', $this->stanza()])),
            'retentionFull' => $configuration['retention']['full'] ?? $this->backup->keep_backups,
            'retentionDiff' => $configuration['retention']['diff'] ?? null,
            'cipherPass' => $configuration['cipher_pass'],
            'processMax' => $configuration['process_max'],
            'walQueueMax' => $configuration['wal_queue_max_gb'],
            'stanza' => $this->stanza(),
            'pgPath' => $pgPath ?? ($isPrimary ? $configuration['pg_path'] : $replica?->configuration['replica']['data_directory']),
            'pgPort' => $pgPort ?? ($isPrimary ? $configuration['pg_port'] : $replica?->configuration['replica']['port']),
            'tlsDirectory' => self::TLS_DIRECTORY,
            'tlsServer' => $clients !== [] ? [
                'address' => $cluster->address($server) ?? '127.0.0.1',
                'port' => self::TLS_PORT,
                'clients' => $clients,
            ] : null,
            'primaryHost' => ! $isPrimary && $tls ? [
                'host' => PostgresCluster::hostAlias($cluster->primary),
                'port' => self::TLS_PORT,
                'path' => $configuration['pg_path'],
                'pgPort' => $configuration['pg_port'],
            ] : null,
        ])->render();
    }

    public function writeTls(Server $server): void
    {
        $files = app(IssueClusterCertificates::class)->files($this->cluster(), $server);

        $server->ssh()->exec('sudo install -d -m 755 /etc/pgbackrest && sudo install -d -o postgres -g postgres -m 700 '.self::TLS_DIRECTORY, 'pgbackrest-tls');

        foreach (['ca' => 'ca.crt', 'cert' => 'node.crt', 'key' => 'node.key'] as $file => $name) {
            self::ensureFile($server, self::TLS_DIRECTORY.'/'.$name, '600');
            $server->ssh()->write(self::TLS_DIRECTORY.'/'.$name, $files[$file], 'postgres', 'pgbackrest-tls');
        }
    }

    public function installServer(): void
    {
        $this->backup->server->ssh()->exec(view('ssh.pgbackrest.server-install'), 'pgbackrest-server-install');
    }

    public function removeServer(Server $server): void
    {
        $server->ssh()->exec(view('ssh.pgbackrest.server-remove'), 'pgbackrest-server-remove');
    }

    public function enableArchiving(): void
    {
        $this->backup->server->ssh()->exec(
            view('ssh.pgbackrest.enable-archiving', [
                'version' => $this->backup->server->database()?->version,
                'stanza' => $this->stanza(),
            ]),
            'pgbackrest-enable-archiving'
        );
    }

    public function disableArchiving(?Server $server = null): void
    {
        $server ??= $this->backup->server;

        $server->ssh()->exec(
            view('ssh.pgbackrest.disable-archiving', [
                'version' => $server->database()?->version,
            ]),
            'pgbackrest-disable-archiving'
        );
    }

    public function startBackup(BackupFile $file, Server $server, string $type, bool $fromStandby): void
    {
        $server->ssh()->exec(
            view('ssh.pgbackrest.start-backup', [
                'unit' => 'vito-pgbackrest-'.$file->id,
                'stanza' => $this->stanza(),
                'type' => $type,
                'standby' => $fromStandby,
            ]),
            'pgbackrest-backup'
        );
    }

    public function startVerify(Server $server): void
    {
        $server->ssh()->exec(
            view('ssh.pgbackrest.start-verify', [
                'unit' => $this->verifyUnitName(),
                'stanza' => $this->stanza(),
            ]),
            'pgbackrest-verify'
        );
    }

    public function verifyUnit(Server $server): TransientUnit
    {
        return new TransientUnit($server, $this->verifyUnitName());
    }

    public function check(): void
    {
        $this->backup->server->ssh()->exec(
            'sudo -u postgres pgbackrest --stanza='.escapeshellarg($this->stanza()).' check',
            'pgbackrest-check'
        );
    }

    public function unitState(BackupFile $file): string
    {
        return $this->unit($file)->state();
    }

    public function failureReason(BackupFile $file): string
    {
        return $this->unit($file)->failureReason();
    }

    public function cleanup(BackupFile $file): void
    {
        $this->unit($file)->cleanup();
    }

    public function info(?Server $server = null): array
    {
        $output = ($server ?? $this->backup->server)->ssh()->clearLog()->exec(
            'sudo -u postgres pgbackrest --stanza='.escapeshellarg($this->stanza()).' --output=json info'
        );

        $start = strpos($output, '[');
        $end = strrpos($output, ']');
        $stanzas = $start === false || $end === false ? null : json_decode(substr($output, $start, $end - $start + 1), true);

        if (! is_array($stanzas)) {
            throw new SSHCommandError('pgBackRest returned an unreadable backup list.');
        }

        return collect($stanzas)->firstWhere('name', $this->stanza()) ?? [];
    }

    public function archiveStatus(): array
    {
        $output = $this->backup->server->ssh()->clearLog()->exec(
            view('ssh.pgbackrest.archive-status', ['stanza' => $this->stanza()])
        );

        preg_match('/^VITO_ARCHIVER=(\d+) (\d+)$/m', $output, $archiver);
        preg_match('/^VITO_DROPPED=(\d+)$/m', $output, $dropped);

        return [
            'failing' => $archiver !== [] && (int) $archiver[2] > (int) $archiver[1],
            'dropped' => (int) ($dropped[1] ?? 0),
        ];
    }

    public function stanza(): string
    {
        return $this->cluster()->stanza;
    }

    private function cluster(): PostgresCluster
    {
        return $this->backup->cluster;
    }

    private function verifyUnitName(): string
    {
        return 'vito-pgbackrest-verify-'.$this->backup->id;
    }

    private function unit(BackupFile $file): TransientUnit
    {
        return new TransientUnit($file->server ?? $this->backup->server, 'vito-pgbackrest-'.$file->id);
    }
}
