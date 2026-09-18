<?php

namespace App\SSH;

use App\Enums\DatabaseReplicaStatus;
use App\Exceptions\SSHCommandError;
use App\Models\DatabaseReplica;
use App\Models\PostgresCluster;
use App\Models\Server;
use App\Services\Database\Postgresql;

class PostgresReplication
{
    public function __construct(protected DatabaseReplica $replica) {}

    /**
     * @return array{data_directory: string, port: int, version_num: int}
     */
    public function inspectReplica(): array
    {
        return self::inspect($this->replica->replica);
    }

    /**
     * @return array{data_directory: string, port: int, version_num: int}
     */
    public static function inspect(Server $server): array
    {
        $values = self::values($server->ssh()->exec(
            view('ssh.database-replication.inspect-replica'),
            'database-replica-inspect'
        ));

        if (! isset($values['DATA_DIRECTORY'], $values['PORT'], $values['VERSION_NUM']) || $values['DATA_DIRECTORY'] === '') {
            throw new SSHCommandError(__('Could not read the PostgreSQL settings of :server.', ['server' => $server->name]));
        }

        return [
            'data_directory' => $values['DATA_DIRECTORY'],
            'port' => (int) $values['PORT'],
            'version_num' => (int) $values['VERSION_NUM'],
        ];
    }

    /**
     * @return array{port: int, ssl: bool, settings: array<string, string>}
     */
    public function configurePrimary(): array
    {
        $primary = $this->replica->primary;
        $sqlPath = '/var/lib/postgresql/vito-replica-'.$this->replica->id.'.sql';

        PgBackRest::ensureFile($primary, $sqlPath, '600');
        $primary->ssh()->write(
            $sqlPath,
            view('ssh.database-replication.primary-role', [
                'username' => $this->replica->username,
                'password' => $this->replica->password,
                'slot' => $this->replica->slot_name,
            ])->render(),
            'postgres',
            'database-replica-role'
        );

        $output = $primary->ssh()->exec(
            view('ssh.database-replication.primary-configure', [
                ...self::primaryAccess($this->replica->cluster),
                'sqlPath' => $sqlPath,
                'slot' => $this->replica->slot_name,
                'majorVersion' => intdiv((int) ($this->replica->configuration['replica']['version_num'] ?? 0), 10000),
            ]),
            'database-replica-configure-primary'
        );

        preg_match_all('/^VITO_SETTING (\w+)=(\d+)$/m', $output, $settings);
        $values = self::values($output);

        if (! isset($values['PORT'])) {
            throw new SSHCommandError('Could not read the port of the primary PostgreSQL server.');
        }

        return [
            'port' => (int) $values['PORT'],
            'ssl' => ($values['SSL'] ?? 'off') === 'on',
            'settings' => array_combine($settings[1], $settings[2]),
        ];
    }

    public function startSeed(bool $delta = false): void
    {
        $server = $this->replica->replica;
        $cluster = $this->replica->cluster;
        $backup = $cluster->backup;
        $configuration = $this->replica->configuration;

        $this->writePassfile();
        $server->ssh()->exec(view('ssh.pgbackrest.install-package'), 'pgbackrest-install');
        $backup->pgBackRest()->writeTls($server);
        $backup->pgBackRest()->writeConfig($server);

        $server->ssh()->exec(
            view('ssh.database-replication.seed-start', [
                'unit' => $this->unitName(),
                'path' => $this->scriptPath(),
                'passfile' => $this->passfile(),
                'script' => view('ssh.database-replication.seed', [
                    'dataDirectory' => $configuration['replica']['data_directory'],
                    'confDirectory' => self::confDirectory($server),
                    'version' => $server->database()?->version,
                    'conninfo' => $this->conninfo(),
                    'slot' => $this->replica->slot_name,
                    'stanza' => $cluster->stanza,
                    'delta' => $delta,
                    'listenAddresses' => $this->listenAddresses($server),
                    'settings' => $configuration['primary']['settings'] ?? [],
                ])->render(),
            ]),
            'database-replica-seed'
        );
    }

    public function seedOutput(int $lines = 300): string
    {
        return $this->seedUnit()->output($lines);
    }

    public function seedUnit(): TransientUnit
    {
        return new TransientUnit($this->replica->replica, $this->unitName());
    }

    public function detachReplica(): void
    {
        $this->replica->replica->ssh()->exec(
            view('ssh.database-replication.replica-detach', [
                'unit' => $this->unitName(),
                'dataDirectory' => $this->replica->configuration['replica']['data_directory'] ?? '',
                'confDirectory' => self::confDirectory($this->replica->replica),
                'files' => [$this->passfile(), $this->scriptPath()],
            ]),
            'database-replica-detach'
        );
    }

    public function promote(): void
    {
        $this->replica->replica->ssh()->exec(
            view('ssh.database-replication.replica-promote', [
                'confDirectory' => self::confDirectory($this->replica->replica),
                'files' => [$this->passfile(), $this->scriptPath()],
            ]),
            'database-replica-promote'
        );
    }

    public function repoint(): void
    {
        $this->writePassfile();

        $this->replica->replica->ssh()->exec(
            view('ssh.database-replication.repoint', [
                'confDirectory' => self::confDirectory($this->replica->replica),
                'conninfo' => $this->conninfo(),
                'slot' => $this->replica->slot_name,
            ]),
            'database-replica-repoint'
        );
    }

    public function dropInactiveSlot(): void
    {
        $this->replica->primary->ssh()->exec(
            'sudo -u postgres psql -X -q -v ON_ERROR_STOP=1 -c '.escapeshellarg("SELECT pg_drop_replication_slot(slot_name) FROM pg_replication_slots WHERE slot_name = '{$this->replica->slot_name}' AND NOT active"),
            'database-replica-drop-slot'
        );
    }

    public function teardownPrimary(): void
    {
        $this->replica->primary->ssh()->exec(
            view('ssh.database-replication.primary-teardown', [
                ...self::primaryAccess($this->replica->cluster, $this->replica),
                'slot' => $this->replica->slot_name,
                'username' => $this->replica->username,
            ]),
            'database-replica-teardown-primary'
        );
    }

    /**
     * @return array<string, string>|null
     */
    public function primaryStatus(): ?array
    {
        $output = $this->replica->primary->ssh()->clearLog()->exec(
            view('ssh.database-replication.status-primary', ['slot' => $this->replica->slot_name])
        );

        return $this->row($output, 'VITO_PRIMARY', [
            'slot_active', 'slot_wal_status', 'slot_retained_bytes', 'max_slot_wal_keep_size_mb',
            'state', 'lag_bytes', 'write_lag_ms', 'flush_lag_ms', 'replay_lag_ms',
        ]);
    }

    /**
     * @return array<string, string>|null
     */
    public function replicaStatus(): ?array
    {
        $output = $this->replica->replica->ssh()->clearLog()->exec(view('ssh.database-replication.status-replica'));

        return $this->row($output, 'VITO_REPLICA', ['in_recovery', 'receiver_status', 'replay_gap_bytes', 'replay_delay_seconds']);
    }

    /**
     * @return array<string, mixed>
     */
    public static function primaryAccess(PostgresCluster $cluster, ?DatabaseReplica $except = null): array
    {
        $replicas = $cluster->replicas()
            ->whereIn('status', [DatabaseReplicaStatus::PENDING, DatabaseReplicaStatus::CONFIGURING, DatabaseReplicaStatus::SEEDING, DatabaseReplicaStatus::READY, DatabaseReplicaStatus::FAILED])
            ->when($except, fn ($query) => $query->whereKeyNot($except->id))
            ->with('replica')
            ->get();

        return [
            'confDirectory' => self::confDirectory($cluster->primary),
            'rules' => $replicas
                ->map(fn (DatabaseReplica $replica): array => ['username' => $replica->username, 'address' => $cluster->address($replica->replica)])
                ->filter(fn (array $rule): bool => filter_var($rule['address'], FILTER_VALIDATE_IP) !== false)
                ->map(fn (array $rule): array => [
                    'username' => $rule['username'],
                    'cidr' => $rule['address'].(str_contains($rule['address'], ':') ? '/128' : '/32'),
                ])
                ->values()
                ->all(),
            'walKeepSizeGb' => $replicas->max('max_slot_wal_keep_size_gb'),
        ];
    }

    private function listenAddresses(Server $server): ?string
    {
        $handler = $server->database()?->handler();

        return $handler instanceof Postgresql && ! $handler->networkingEnabled() ? $handler->listenAddresses(false) : null;
    }

    public static function confDirectory(Server $server): string
    {
        return '/etc/postgresql/'.$server->database()?->version.'/main/conf.d';
    }

    private function writePassfile(): void
    {
        PgBackRest::ensureFile($this->replica->replica, $this->passfile(), '600');
        $this->replica->replica->ssh()->write($this->passfile(), implode(':', [
            PostgresCluster::hostAlias($this->replica->primary),
            $this->replica->configuration['primary']['port'],
            'replication',
            $this->replica->username,
            $this->replica->password,
        ])."\n", 'postgres', 'database-replica-passfile');
    }

    private function conninfo(): string
    {
        return implode(' ', [
            'host='.PostgresCluster::hostAlias($this->replica->primary),
            'port='.$this->replica->configuration['primary']['port'],
            'user='.$this->replica->username,
            'passfile='.$this->passfile(),
            'application_name='.$this->replica->applicationName(),
            'sslmode='.(($this->replica->configuration['primary']['ssl'] ?? false) ? 'require' : 'prefer'),
        ]);
    }

    private function passfile(): string
    {
        return '/var/lib/postgresql/.vito-replica-'.$this->replica->id.'.pgpass';
    }

    private function scriptPath(): string
    {
        return '/var/lib/vito/replica-seed-'.$this->replica->id.'.sh';
    }

    private function unitName(): string
    {
        return 'vito-replica-seed-'.$this->replica->id;
    }

    /**
     * @return array<string, string>
     */
    private static function values(string $output): array
    {
        preg_match_all('/^VITO_([A-Z_]+)=(.*)$/m', $output, $matches);

        return array_combine($matches[1], array_map(trim(...), $matches[2]));
    }

    /**
     * @param  list<string>  $columns
     * @return array<string, string>|null
     */
    private function row(string $output, string $prefix, array $columns): ?array
    {
        if (preg_match('/^'.$prefix.'\|(.*)$/m', $output, $match) !== 1) {
            return null;
        }

        return array_combine($columns, array_pad(array_slice(explode('|', trim($match[1])), 0, count($columns)), count($columns), ''));
    }
}
