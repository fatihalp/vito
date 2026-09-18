<?php

namespace App\Actions\StorageMigration;

use App\Actions\Database\CreateDatabaseUser;
use App\Actions\Database\DeleteDatabaseUser;
use App\Actions\FirewallRule\ManageRule;
use App\Actions\Service\SyncServiceStatus;
use App\Actions\Service\ToggleNetworking;
use App\Enums\FirewallRuleStatus;
use App\Enums\ServiceStatus;
use App\Models\Database;
use App\Models\Project;
use App\Models\Server;
use App\Models\StorageMigration;
use App\Services\SupportsNetworking;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class ManageStorageMigrationDatabase
{
    private static array $readyTables = [];

    public function connect(Project $project, array $input): array
    {
        Validator::make($input, [
            'server_id' => [
                'required',
                'integer',
                Rule::exists('servers', 'id')->where('project_id', $project->id),
            ],
            'database_id' => [
                'required',
                'integer',
                Rule::exists('databases', 'id')->where('server_id', (int) ($input['server_id'] ?? 0))->whereNull('deleted_at'),
            ],
        ])->validate();

        $server = Server::query()->where('project_id', $project->id)->findOrFail((int) $input['server_id']);
        $database = Database::query()->where('server_id', $server->id)->findOrFail((int) $input['database_id']);
        $service = $server->database();
        $handler = $service?->handler();

        if (! $server->isReady() || ! $handler instanceof SupportsNetworking) {
            throw ValidationException::withMessages([
                'server_id' => __('Select a ready server with a MySQL, MariaDB or PostgreSQL service.'),
            ]);
        }

        $extension = $service->name === 'postgresql' ? 'pdo_pgsql' : 'pdo_mysql';

        if (! extension_loaded($extension)) {
            throw ValidationException::withMessages([
                'server_id' => __('Install the :extension PHP extension on the Vito server to use this database.', ['extension' => $extension]),
            ]);
        }

        $vitoIp = $server->is_self ? null : $this->vitoIp($server);

        if ($vitoIp !== null && ! $handler->networkingEnabled() && ! in_array($service->status, SyncServiceStatus::SETTLED_STATUSES, true)) {
            throw ValidationException::withMessages([
                'server_id' => __('Wait for the database service to settle before using it.'),
            ]);
        }

        $databaseUser = app(CreateDatabaseUser::class)->create($server, [
            'username' => 'vito_migration_'.Str::lower(Str::random(8)),
            'password' => Str::password(32, symbols: false),
            'permission' => 'admin',
            'remote' => $vitoIp !== null,
            'host' => $vitoIp,
        ], [$database->name]);

        try {
            if ($vitoIp !== null && ! $handler->networkingEnabled()) {
                app(ToggleNetworking::class)->enable($service);
            }

            $firewallRule = $vitoIp !== null && $server->firewall() ? app(ManageRule::class)->allow($server, $handler->networkingPort(), $vitoIp, 'vito-migration-db') : null;
        } catch (Throwable $e) {
            app(DeleteDatabaseUser::class)->delete($server, $databaseUser, allowManaged: true);

            throw $e;
        }

        return [
            'database_id' => $database->id,
            'database_user_id' => $databaseUser->id,
            'firewall_rule_id' => $firewallRule?->id,
        ];
    }

    public static function unreachable(Throwable $e): bool
    {
        return $e instanceof QueryException && str_starts_with($e->getMessage(), 'SQLSTATE[08');
    }

    public static function forgetAccessCheck(StorageMigration $storageMigration): void
    {
        Cache::forget('storage-migration-access-'.$storageMigration->id);
    }

    /**
     * Keeps the firewall rule of a remote scan database pointed at the address Vito connects from, which changes when Vito runs
     * behind a dynamic IP. Returns false while the firewall is being updated.
     */
    public function refreshAccess(StorageMigration $storageMigration): bool
    {
        $server = $storageMigration->database?->server;
        $handler = $server?->database()?->handler();

        if ($server === null || $server->is_self || ! $server->firewall() || ! $handler instanceof SupportsNetworking) {
            return true;
        }

        $ip = $this->vitoIp($server);
        $rule = $storageMigration->firewallRule;
        $input = [
            'name' => 'vito-migration-db',
            'type' => 'allow',
            'protocol' => 'tcp',
            'port' => (string) $handler->networkingPort(),
            'source_any' => false,
            'source' => $ip,
            'mask' => str_contains($ip, ':') ? 128 : 32,
        ];

        if ($rule === null || $rule->status === FirewallRuleStatus::DELETING) {
            $rule = app(ManageRule::class)->allow($server, $handler->networkingPort(), $ip, 'vito-migration-db');
            $storageMigration->update(['firewall_rule_id' => $rule->id]);
        } elseif ($rule->source !== null && $rule->source !== $ip && $rule->status === FirewallRuleStatus::READY) {
            $rule = app(ManageRule::class)->update($rule, $input);
        }

        return $rule->refresh()->status === FirewallRuleStatus::READY;
    }

    public function ready(StorageMigration $storageMigration): bool
    {
        if ($storageMigration->database_id !== null && Cache::add('storage-migration-access-'.$storageMigration->id, true, 300) && ! $this->refreshAccess($storageMigration)) {
            self::forgetAccessCheck($storageMigration);

            return false;
        }

        if ($storageMigration->database_id !== null) {
            $storageMigration->unsetRelation('firewallRule');
            $server = $storageMigration->database?->server;
            $service = $server?->database();
            $handler = $service?->handler();
            $firewallStatus = $storageMigration->firewallRule?->status;

            if (! $handler instanceof SupportsNetworking) {
                throw new RuntimeException(__('The scan database of this storage migration is no longer available.'));
            }

            if ($service->status === ServiceStatus::FAILED || $handler->networkingFailed() || $firewallStatus === FirewallRuleStatus::FAILED) {
                throw new RuntimeException(__('Could not open access to the scan database on :server.', ['server' => $server->name]));
            }

            if ((! $server->is_self && ! $handler->networkingEnabled())
                || in_array($firewallStatus, [FirewallRuleStatus::CREATING, FirewallRuleStatus::UPDATING], true)) {
                return false;
            }
        }

        $this->ensureItemsTable($storageMigration);

        return true;
    }

    public function disconnect(StorageMigration $storageMigration): void
    {
        $databaseUser = $storageMigration->databaseUser;

        if ($storageMigration->database_id === null || ($databaseUser && $storageMigration->database?->server?->database())) {
            Schema::connection($storageMigration->itemsConnection())->dropIfExists($storageMigration->itemsTable());
            Schema::connection($storageMigration->itemsConnection())->dropIfExists($storageMigration->targetsTable());
        }

        if ($databaseUser?->server?->database()) {
            app(DeleteDatabaseUser::class)->delete($databaseUser->server, $databaseUser, allowManaged: true);
        }

        $rule = $storageMigration->firewallRule;

        if ($rule !== null && $rule->name === 'vito-migration-db' && StorageMigration::query()->whereKeyNot($storageMigration->id)->where('firewall_rule_id', $rule->id)->doesntExist()) {
            app(ManageRule::class)->delete($rule);
        }
    }

    private function ensureItemsTable(StorageMigration $storageMigration): void
    {
        $connection = $storageMigration->itemsConnection();
        $itemsTable = $storageMigration->itemsTable();

        if (isset(self::$readyTables[$connection.'.'.$itemsTable])) {
            return;
        }

        Cache::lock("storage-migration-items-table-{$storageMigration->id}", 60)->block(30, function () use ($connection, $itemsTable, $storageMigration): void {
            if (! Schema::connection($connection)->hasTable($storageMigration->targetsTable())) {
                Schema::connection($connection)->create($storageMigration->targetsTable(), function (Blueprint $table): void {
                    $table->char('key_hash', 40)->primary();
                    $table->bigInteger('size');
                });
            }

            if (Schema::connection($connection)->hasTable($itemsTable)) {
                return;
            }

            Schema::connection($connection)->create($itemsTable, function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('backup_file_id')->nullable()->index();
                $table->string('source_key', 1024);
                $table->char('source_key_hash', 40)->unique();
                $table->string('target_key', 1024);
                $table->bigInteger('size')->nullable();
                $table->bigInteger('copied_bytes')->nullable();
                $table->string('checksum')->nullable();
                $table->string('status')->default('pending');
                $table->unsignedInteger('attempts')->default(0);
                $table->text('error')->nullable();
                $table->unsignedSmallInteger('worker_slot')->nullable();
                $table->timestamps();

                $table->index(['status', 'id']);
            });
        });

        self::$readyTables[$connection.'.'.$itemsTable] = true;
    }

    private function vitoIp(Server $server): string
    {
        $ip = Str::before(trim($server->ssh()->clearLog()->exec('echo "${SSH_CLIENT:-}"')), ' ');

        if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_RES_RANGE)) {
            throw ValidationException::withMessages([
                'server_id' => __('Could not determine which IP address Vito uses to reach this server.'),
            ]);
        }

        return $ip;
    }
}
