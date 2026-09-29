<?php

namespace App\SSH;

use App\Exceptions\SSHCommandError;
use App\Models\DatabaseUpgrade;
use App\Models\Server;
use Illuminate\Support\Str;

/**
 * Runs the PostgreSQL side of an upgrade: publications and a replication role on the old server, and databases,
 * schemas and subscriptions on the new one. Logical replication copies rows, so both servers keep their own data
 * files and may run different PostgreSQL major versions.
 */
class PostgresLogicalReplication
{
    public function __construct(protected DatabaseUpgrade $upgrade) {}

    /**
     * Reads what an upgrade of this server would involve, without changing anything.
     *
     * @return array{version_num: int, in_recovery: bool, wal_level: string, max_replication_slots: int, used_slots: int, max_wal_senders: int, used_senders: int, read_only: bool, port: int, ssl: bool, databases: list<array{name: string, size: int, tables: int, without_key: int, unlogged: int, materialized_views: int, large_objects: int, extensions: list<string>}>, tables_without_key: list<string>}
     */
    public static function inspect(Server $server): array
    {
        $output = $server->ssh()->exec(view('ssh.database-upgrade.preflight'), 'database-upgrade-preflight');
        $values = self::values($output);

        if (! isset($values['VERSION_NUM'], $values['WAL_LEVEL'])) {
            throw new SSHCommandError(__('Could not read the PostgreSQL settings of :server.', ['server' => $server->name]));
        }

        $databases = [];

        foreach (self::rows($output, 'VITO_DB') as $row) {
            $databases[] = [
                'name' => $row[0],
                'size' => (int) ($row[1] ?? 0),
                'tables' => (int) ($row[2] ?? 0),
                'without_key' => (int) ($row[3] ?? 0),
                'unlogged' => (int) ($row[4] ?? 0),
                'materialized_views' => (int) ($row[5] ?? 0),
                'large_objects' => (int) ($row[6] ?? 0),
                'extensions' => array_values(array_filter(explode(' ', $row[7] ?? ''))),
            ];
        }

        return [
            'version_num' => (int) $values['VERSION_NUM'],
            'in_recovery' => ($values['IN_RECOVERY'] ?? 'f') === 't',
            'wal_level' => $values['WAL_LEVEL'],
            'max_replication_slots' => (int) ($values['MAX_REPLICATION_SLOTS'] ?? 0),
            'used_slots' => (int) ($values['USED_SLOTS'] ?? 0),
            'max_wal_senders' => (int) ($values['MAX_WAL_SENDERS'] ?? 0),
            'used_senders' => (int) ($values['USED_SENDERS'] ?? 0),
            'read_only' => ($values['READ_ONLY'] ?? 'off') === 'on',
            'port' => (int) ($values['PORT'] ?? 5432),
            'ssl' => ($values['SSL'] ?? 'off') === 'on',
            'databases' => $databases,
            'tables_without_key' => array_map(fn (array $row): string => $row[0].'.'.($row[1] ?? ''), self::rows($output, 'VITO_NOPK')),
        ];
    }

    /**
     * Creates the replication role, the pg_hba rule and a publication per database on the old server, and asks for the
     * settings logical replication needs. Returns the settings PostgreSQL applies right now, before any restart.
     *
     * @return array{wal_level: string, max_replication_slots: int, max_wal_senders: int, port: int, ssl: bool}
     */
    public function prepareSource(): array
    {
        $source = $this->upgrade->source;
        $preflight = $this->upgrade->preflight;
        $names = array_column($this->upgrade->databases(), 'name');
        $sqlPath = '/var/lib/postgresql/vito-upgrade-'.$this->upgrade->id.'.sql';

        PgBackRest::ensureFile($source, $sqlPath, '600');
        $source->ssh()->write($sqlPath, view('ssh.database-upgrade.source-role', [
            'username' => $this->upgrade->username,
            'password' => $this->upgrade->password,
            'databases' => $names,
        ])->render(), 'postgres');

        $output = $source->ssh()->exec(view('ssh.database-upgrade.source-prepare', [
            'sqlPath' => $sqlPath,
            'confDirectory' => PostgresReplication::confDirectory($source),
            'rules' => $this->rules(),
            'logical' => $preflight['wal_level'] !== 'logical',
            'replicaIdentity' => ($preflight['replica_identity'] ?? 'leave') === 'full',
            'slots' => $preflight['required_slots'],
            'senders' => $preflight['required_senders'],
            'databases' => $names,
            'publication' => $this->publication(),
        ]), 'database-upgrade-source');

        $values = self::values($output);

        return [
            'wal_level' => $values['WAL_LEVEL'] ?? '',
            'max_replication_slots' => (int) ($values['MAX_REPLICATION_SLOTS'] ?? 0),
            'max_wal_senders' => (int) ($values['MAX_WAL_SENDERS'] ?? 0),
            'port' => (int) ($values['PORT'] ?? 5432),
            'ssl' => ($values['SSL'] ?? 'off') === 'on',
        ];
    }

    /**
     * Asks the new server for enough background workers and origins to apply every database at once.
     *
     * @return array{max_worker_processes: int, max_logical_replication_workers: int, max_replication_slots: int}
     */
    public function prepareTargetSettings(): array
    {
        $target = $this->upgrade->target;
        $count = count($this->upgrade->databases());

        $output = $target->ssh()->exec(view('ssh.database-upgrade.target-settings', [
            'confDirectory' => PostgresReplication::confDirectory($target),
            'processes' => max(8, $count * 3 + 8),
            'workers' => max(4, $count * 3),
            'slots' => max(10, $count + 5),
        ]), 'database-upgrade-target-settings');

        $values = self::values($output);

        return [
            'max_worker_processes' => (int) ($values['MAX_WORKER_PROCESSES'] ?? 0),
            'max_logical_replication_workers' => (int) ($values['MAX_LOGICAL_REPLICATION_WORKERS'] ?? 0),
            'max_replication_slots' => (int) ($values['MAX_REPLICATION_SLOTS'] ?? 0),
        ];
    }

    /**
     * Copies the roles of the old server, with their passwords, to the new one. The dump never reaches a log or the
     * database: Vito reads it without logging and writes it straight to a file only postgres can read.
     */
    public function copyRoles(): string
    {
        $dump = $this->upgrade->source->ssh()->clearLog()->exec('sudo -u postgres pg_dumpall --roles-only');
        $roles = collect(preg_split('/\R/', $dump) ?: [])
            ->reject(fn (string $line): bool => preg_match('/\bvito_(upgrade|replica)_/', $line) === 1)
            ->implode("\n");

        $path = '/var/lib/postgresql/vito-upgrade-'.$this->upgrade->id.'-roles.sql';
        PgBackRest::ensureFile($this->upgrade->target, $path, '600');
        $this->upgrade->target->ssh()->write($path, $roles."\n", 'postgres');

        return $path;
    }

    /**
     * Starts the first copy: roles, databases, schemas and one subscription per database, in a unit that survives Vito.
     */
    public function startPrepare(): void
    {
        $this->writePassfile();
        $rolesPath = $this->copyRoles();

        $this->prepareUnit()->start(view('ssh.database-upgrade.target-prepare', [
            'state' => $this->state(),
            'rolesPath' => $rolesPath,
            'publication' => $this->publication(),
            'username' => $this->upgrade->username,
            'version' => (int) $this->upgrade->target_version,
            'options' => 'copy_data = true'.((int) $this->upgrade->target_version >= 14 ? ', streaming = on' : ''),
            'databases' => $this->databases(),
        ])->render(), 'Vito PostgreSQL upgrade');
    }

    public function prepareUnit(): TransientUnit
    {
        return new TransientUnit($this->upgrade->target, 'vito-upgrade-'.$this->upgrade->id);
    }

    /**
     * How far the first copy got, per database, on the new server.
     *
     * @return list<array{name: string, tables: int, copied: int, workers: int, errors: int, seconds_since_change: int}>
     */
    public function targetStatus(): array
    {
        $output = $this->upgrade->target->ssh()->clearLog()->exec(view('ssh.database-upgrade.target-status', [
            'databases' => $this->databases(),
        ]));

        return array_map(fn (array $row): array => [
            'name' => $row[0],
            'tables' => (int) ($row[1] ?? 0),
            'copied' => (int) ($row[2] ?? 0),
            'workers' => (int) ($row[3] ?? 0),
            'errors' => (int) ($row[4] ?? 0),
            'seconds_since_change' => (int) ($row[5] ?? -1),
        ], self::rows($output, 'VITO_SUB'));
    }

    /**
     * The replication slots the new server holds on the old one, with how much WAL each one still has to apply.
     *
     * @return array{slots: list<array{name: string, active: bool, lag_bytes: int, wal_status: string}>, read_only: bool}
     */
    public function sourceStatus(): array
    {
        $output = $this->upgrade->source->ssh()->clearLog()->exec(view('ssh.database-upgrade.source-status', [
            'slotPrefix' => $this->slotPrefix(),
        ]));

        return [
            'slots' => array_map(fn (array $row): array => [
                'name' => $row[0],
                'active' => ($row[1] ?? 'f') === 't',
                'lag_bytes' => (int) ($row[2] ?? 0),
                'wal_status' => $row[3] ?? '',
            ], self::rows($output, 'VITO_SLOT')),
            'read_only' => (self::values($output)['READ_ONLY'] ?? 'off') === 'on',
        ];
    }

    /**
     * Blocks new writes on the old server, disconnects its clients and waits until the new server applied everything.
     *
     * @return array{lsn: string, remaining: int, slots: int}
     */
    public function cutover(int $minutes = 10): array
    {
        $output = $this->upgrade->source->ssh()->exec(view('ssh.database-upgrade.cutover', [
            'username' => $this->upgrade->username,
            'slotPrefix' => $this->slotPrefix(),
            'attempts' => $minutes * 30,
        ]), 'database-upgrade-cutover', timeout: $minutes * 60 + 120);

        $values = self::values($output);

        return [
            'lsn' => $values['LSN'] ?? '',
            'remaining' => (int) ($values['REMAINING'] ?? -1),
            'slots' => (int) ($values['SLOTS'] ?? 0),
        ];
    }

    /**
     * Copies the sequence values logical replication leaves behind and stops the subscriptions on the new server.
     */
    public function finish(bool $sequences): void
    {
        $this->upgrade->target->ssh()->exec(view('ssh.database-upgrade.finish', [
            'state' => $this->state(),
            'sequences' => $sequences,
            'passfile' => $this->passfile(),
            'confDirectory' => PostgresReplication::confDirectory($this->upgrade->target),
            'databases' => $this->databases(),
        ]), 'database-upgrade-finish', timeout: 600);
    }

    /**
     * Removes the publications, slots, role and pg_hba rule Vito added to the old server.
     */
    public function cleanupSource(bool $resetReadOnly): void
    {
        $this->upgrade->source->ssh()->exec(view('ssh.database-upgrade.source-cleanup', [
            'databases' => array_column($this->upgrade->databases(), 'name'),
            'publication' => $this->publication(),
            'username' => $this->upgrade->username,
            'slotPrefix' => $this->slotPrefix(),
            'resetReadOnly' => $resetReadOnly,
            'confDirectory' => PostgresReplication::confDirectory($this->upgrade->source),
            'rules' => [],
        ]), 'database-upgrade-source-cleanup');
    }

    /**
     * @return list<array{name: string, subscription: string, conninfo: string}>
     */
    public function databases(): array
    {
        return array_map(fn (array $database): array => [
            'name' => $database['name'],
            'subscription' => $this->upgrade->subscriptionName($database['name']),
            'conninfo' => $this->conninfo($database['name']),
        ], $this->upgrade->databases());
    }

    public function publication(): string
    {
        return 'vito_upgrade_'.$this->upgrade->id;
    }

    public function slotPrefix(): string
    {
        return 'vito_upgrade_'.$this->upgrade->id.'_';
    }

    private function conninfo(string $database): string
    {
        return implode(' ', [
            'host='.($this->upgrade->configuration['source_address'] ?? ''),
            'port='.($this->upgrade->configuration['source_port'] ?? 5432),
            'user='.$this->upgrade->username,
            'dbname='.$database,
            'passfile='.$this->passfile(),
            'sslmode='.(($this->upgrade->configuration['source_ssl'] ?? false) ? 'require' : 'prefer'),
            'application_name='.$this->slotPrefix(),
        ]);
    }

    private function writePassfile(): void
    {
        PgBackRest::ensureFile($this->upgrade->target, $this->passfile(), '600');
        $this->upgrade->target->ssh()->write($this->passfile(), implode(':', [
            $this->upgrade->configuration['source_address'] ?? '',
            $this->upgrade->configuration['source_port'] ?? 5432,
            '*',
            $this->upgrade->username,
            $this->upgrade->password,
        ])."\n", 'postgres');
    }

    private function passfile(): string
    {
        return '/var/lib/postgresql/.vito-upgrade-'.$this->upgrade->id.'.pgpass';
    }

    private function state(): string
    {
        return '/var/lib/vito/upgrade-'.$this->upgrade->id;
    }

    /**
     * @return list<array{username: string, cidr: string}>
     */
    private function rules(): array
    {
        $address = $this->upgrade->configuration['target_address'] ?? null;

        if (filter_var($address, FILTER_VALIDATE_IP) === false) {
            return [];
        }

        return [[
            'username' => $this->upgrade->username,
            'cidr' => $address.(Str::contains($address, ':') ? '/128' : '/32'),
        ]];
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
     * @return list<list<string>>
     */
    private static function rows(string $output, string $prefix): array
    {
        preg_match_all('/^'.$prefix.'\|(.*)$/m', $output, $matches);

        return array_map(fn (string $line): array => explode('|', trim($line)), $matches[1]);
    }
}
