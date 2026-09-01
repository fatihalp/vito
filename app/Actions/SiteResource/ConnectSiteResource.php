<?php

namespace App\Actions\SiteResource;

use App\Actions\Database\CreateDatabase;
use App\Actions\Database\CreateDatabaseUser;
use App\Actions\FirewallRule\ManageRule;
use App\Actions\Service\ToggleNetworking;
use App\Enums\ServerRole;
use App\Enums\SiteResourceStatus;
use App\Enums\SiteResourceType;
use App\Helpers\EnvParser;
use App\Jobs\SiteResource\FinalizeConnectionJob;
use App\Models\Database;
use App\Models\DatabaseUser;
use App\Models\FirewallRule;
use App\Models\Server;
use App\Models\Service;
use App\Models\Site;
use App\Models\SiteResource;
use App\Models\StorageProvider;
use App\Services\SupportsNetworking;
use App\Services\SupportsNetworkingSecret;
use App\Services\Database\Database as DatabaseHandler;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class ConnectSiteResource
{
    public function __construct(private SyncManagedEnvironment $environment) {}

    public function connect(Site $site, array $input): SiteResource
    {
        $type = SiteResourceType::tryFrom((string) ($input['type'] ?? ''));
        $projectId = $site->server->project_id;
        $user = auth()->user() ?? (function_exists('user') ? user() : null);
        $isAdmin = $user && method_exists($user, 'isAdmin') && $user->isAdmin();

        $validator = Validator::make($input, [
            'type' => ['required', Rule::enum(SiteResourceType::class)],
            'server_id' => [
                'exclude_if:type,storage',
                'required',
                'integer',
                Rule::exists('servers', 'id')->where(function (Builder $query) use ($projectId, $type, $site, $isAdmin): void {
                    if (! $isAdmin) {
                        $query->where('project_id', $projectId);
                    }
                    $query->where(function (Builder $query) use ($type, $site): void {
                            $query->where('role', $type?->serverRole()?->value)
                                ->orWhere('id', $site->server_id);
                        })
                        ->whereIn('status', ['ready', 'updating']);
                }),
            ],
            'storage_provider_id' => [
                'exclude_unless:type,storage',
                'required',
                'integer',
                Rule::exists('storage_providers', 'id')->where(function (Builder $query) use ($projectId, $isAdmin): void {
                    if (! $isAdmin) {
                        $query->where('project_id', $projectId)
                            ->orWhereNull('project_id');
                    }
                }),
            ],
            'database_id' => ['nullable', 'integer'],
            'database_name' => ['nullable', 'string', 'max:64'],
        ]);

        $data = $validator->validate();

        $type = SiteResourceType::from($data['type']);

        if ($site->resources()->where('type', $type->value)->exists()) {
            throw ValidationException::withMessages(['type' => __('This resource type is already connected to the site.')]);
        }

        if ($type === SiteResourceType::STORAGE) {
            return $this->connectStorage($site, (int) $data['storage_provider_id'], $isAdmin);
        }

        $serverQuery = Server::query();
        if (! $isAdmin) {
            $serverQuery->where('project_id', $site->server->project_id);
        }
        $server = $serverQuery->findOrFail((int) $data['server_id']);

        $isOwnServer = $server->id === $site->server_id;

        if (! $isOwnServer && $server->role !== $type->serverRole()) {
            throw ValidationException::withMessages([
                'server_id' => __('Select a ready :role.', ['role' => $type->serverRole()?->getText()]),
            ]);
        }

        if (! $server->isReady()) {
            throw ValidationException::withMessages([
                'server_id' => __('Select a ready :role.', ['role' => $type->serverRole()?->getText()]),
            ]);
        }

        return match ($type) {
            SiteResourceType::DATABASE => $this->connectDatabase($site, $server, $data),
            SiteResourceType::CACHE => $this->connectCache($site, $server),
        };
    }

    private function connectDatabase(Site $site, Server $server, array $options = []): SiteResource
    {
        $this->checkExistingDatabaseConfiguration($site);

        $isLocal = $server->id === $site->server_id;

        $service = $server->database();
        $handler = $service?->handler();

        if (! $service || ! $handler instanceof DatabaseHandler || ! $handler instanceof SupportsNetworking) {
            throw ValidationException::withMessages(['server_id' => __('The selected server has no network-capable database service.')]);
        }

        $charsetData = $handler->getCharsets();
        $charset = (string) ($charsetData['defaultCharset'] ?? array_key_first($charsetData['charsets']));
        $collation = (string) ($charsetData['charsets'][$charset]['default'] ?? $charsetData['charsets'][$charset]['list'][0] ?? '');

        if ($charset === '' || $collation === '') {
            throw ValidationException::withMessages(['server_id' => __('Could not determine database charset settings.')]);
        }

        $existingDb = ! empty($options['database_id'])
            ? Database::where('server_id', $server->id)->find($options['database_id'])
            : null;

        $name = $existingDb ? $existingDb->name : (! empty($options['database_name']) ? $options['database_name'] : 'site_'.$site->id);
        $username = 'site_'.$site->id.'_'.Str::lower(Str::random(6));
        $password = Str::password(32, symbols: false);
        $database = $existingDb;
        $databaseUser = null;
        $firewallRule = null;

        try {
            if (! $isLocal) {
                $this->enableNetworking($service, $handler);
            }
            if (! $database) {
                $database = app(CreateDatabase::class)->create($server, [
                    'name' => $name,
                    'charset' => $charset,
                    'collation' => $collation,
                ]);
            }
            $databaseUser = $isLocal
                ? app(CreateDatabaseUser::class)->create($server, [
                    'username' => $username,
                    'password' => $password,
                    'permission' => 'admin',
                ], [$database->name])
                : app(CreateDatabaseUser::class)->create($server, [
                    'username' => $username,
                    'password' => $password,
                    'permission' => 'admin',
                    'remote' => true,
                    'host' => $this->host($site->server),
                ], [$database->name]);

            $connection = match ($service->name) {
                'postgresql' => 'pgsql',
                default => 'mysql',
            };

            if ($isLocal) {
                return $this->persist($site, SiteResourceType::DATABASE, $server, null, [
                    'database_id' => $database->id,
                    'database_user_id' => $databaseUser->id,
                ], [
                    'DB_CONNECTION' => $connection,
                    'DB_HOST' => '127.0.0.1',
                    'DB_PORT' => (string) $handler->networkingPort(),
                    'DB_DATABASE' => $database->name,
                    'DB_USERNAME' => $databaseUser->username,
                    'DB_PASSWORD' => $password,
                ]);
            }

            $firewallRule = $this->allowApplicationServer($site, $server, $handler->networkingPort(), $this->firewallName($site, 'db'));

            return $this->persist($site, SiteResourceType::DATABASE, $server, null, [
                'database_id' => $database->id,
                'database_user_id' => $databaseUser->id,
                'firewall_rule_id' => $firewallRule?->id,
            ], [
                'DB_CONNECTION' => $connection,
                'DB_HOST' => $this->host($server),
                'DB_PORT' => (string) $handler->networkingPort(),
                'DB_DATABASE' => $database->name,
                'DB_USERNAME' => $databaseUser->username,
                'DB_PASSWORD' => $password,
            ], deferEnvironment: true);
        } catch (Throwable $e) {
            $this->cleanupDatabase($handler, $database, $databaseUser, $firewallRule);

            throw $e;
        }
    }

    private function connectCache(Site $site, Server $server): SiteResource
    {
        $isLocal = $server->id === $site->server_id;

        $service = $server->memoryDatabase();
        $handler = $service?->handler();

        if (! $service || ! $handler instanceof SupportsNetworkingSecret) {
            throw ValidationException::withMessages(['server_id' => __('The selected server has no network-capable Redis service.')]);
        }

        if ($isLocal) {
            return $this->persist($site, SiteResourceType::CACHE, $server, null, [], [
                'CACHE_STORE' => 'redis',
                'QUEUE_CONNECTION' => 'redis',
                'REDIS_CLIENT' => 'phpredis',
                'REDIS_HOST' => '127.0.0.1',
                'REDIS_PASSWORD' => (string) ($service->secret ?? ''),
                'REDIS_PORT' => (string) $handler->networkingPort(),
            ]);
        }

        $firewallRule = null;

        try {
            $this->enableNetworking($service, $handler);
            $service->refresh();
            $firewallRule = $this->allowApplicationServer($site, $server, $handler->networkingPort(), $this->firewallName($site, 'redis'));

            return $this->persist($site, SiteResourceType::CACHE, $server, null, [
                'firewall_rule_id' => $firewallRule?->id,
            ], [
                'CACHE_STORE' => 'redis',
                'QUEUE_CONNECTION' => 'redis',
                'REDIS_CLIENT' => 'phpredis',
                'REDIS_HOST' => $this->host($server),
                'REDIS_PASSWORD' => (string) $service->secret,
                'REDIS_PORT' => (string) $handler->networkingPort(),
            ], deferEnvironment: true);
        } catch (Throwable $e) {
            if ($firewallRule) {
                app(ManageRule::class)->delete($firewallRule);
            }

            throw $e;
        }
    }

    private function connectStorage(Site $site, int $storageProviderId, bool $isAdmin): SiteResource
    {
        $storageProvider = StorageProvider::query()
            ->where(function ($query) use ($site, $isAdmin): void {
                if (! $isAdmin) {
                    $query->where('project_id', $site->server->project_id)
                        ->orWhereNull('project_id');
                }
            })
            ->findOrFail($storageProviderId);

        $credentials = $storageProvider->credentials ?? [];
        $endpoint = $credentials['api_url'] ?? ($credentials['endpoint'] ?? '');
        $region = $credentials['region'] ?? 'us-east-1';
        $bucket = $credentials['bucket'] ?? '';
        $key = $credentials['key'] ?? '';
        $secret = $credentials['secret'] ?? '';

        $env = [
            'FILESYSTEM_DISK' => 's3',
            'AWS_ACCESS_KEY_ID' => (string) $key,
            'AWS_SECRET_ACCESS_KEY' => (string) $secret,
            'AWS_DEFAULT_REGION' => (string) $region,
            'AWS_BUCKET' => (string) $bucket,
            'AWS_ENDPOINT' => (string) $endpoint,
            'AWS_USE_PATH_STYLE_ENDPOINT' => ! empty($endpoint) ? 'true' : 'false',
        ];

        return $this->persist($site, SiteResourceType::STORAGE, null, $storageProvider, [], $env);
    }

    private function persist(
        Site $site,
        SiteResourceType $type,
        ?Server $server,
        ?StorageProvider $storageProvider,
        array $configuration,
        array $environment,
        bool $deferEnvironment = false,
    ): SiteResource {
        $parsed = EnvParser::classify(
            EnvParser::parse($site->server->os()->readFile($site->resolveEnvPath())),
            $site->env_variables,
        );
        $live = collect($parsed)
            ->pluck('value', 'key');
        $original = [];

        foreach (array_keys($environment) as $key) {
            $original[$key] = $live->has($key) ? (string) $live->get($key) : null;
        }

        $configuration['original_secret_keys'] = array_values(array_intersect(
            array_keys($environment),
            collect($parsed)->where('is_secret', true)->pluck('key')->all(),
        ));

        $resource = $site->resources()->create([
            'server_id' => $server?->id,
            'storage_provider_id' => $storageProvider?->id,
            'type' => $type,
            'status' => $deferEnvironment ? SiteResourceStatus::CONNECTING : SiteResourceStatus::READY,
            'configuration' => $configuration,
            'environment' => $environment,
            'original_environment' => $original,
        ]);

        if ($deferEnvironment) {
            dispatch(new FinalizeConnectionJob($resource))->onQueue('ssh');
        } else {
            try {
                $this->environment->sync($site);
            } catch (Throwable $e) {
                $resource->delete();
                throw $e;
            }
        }

        return $resource;
    }

    private function enableNetworking(Service $service, SupportsNetworking $handler): void
    {
        if (! $handler->networkingEnabled()) {
            app(ToggleNetworking::class)->enable($service);
        }
    }

    private function allowApplicationServer(Site $site, Server $server, int $port, string $name): ?FirewallRule
    {
        if (! $server->firewall()) {
            return null;
        }

        return app(ManageRule::class)->create($server, [
            'name' => $name,
            'type' => 'allow',
            'protocol' => 'tcp',
            'port' => (string) $port,
            'source_any' => false,
            'source' => $this->host($site->server),
            'mask' => str_contains($this->host($site->server), ':') ? 128 : 32,
        ]);
    }

    private function firewallName(Site $site, string $suffix): string
    {
        return substr('site-'.$site->id.'-'.$suffix, 0, 18);
    }

    private function host(Server $server): string
    {
        return $server->local_ip ?: $server->ip;
    }

    private function cleanupDatabase(
        DatabaseHandler $handler,
        ?Database $database,
        ?DatabaseUser $user,
        ?FirewallRule $firewallRule,
    ): void
    {
        if ($firewallRule) {
            app(ManageRule::class)->delete($firewallRule);
        }

        if ($user) {
            $handler->deleteUser($user->username, $user->host);
            $user->delete();
        }

        if ($database) {
            $handler->delete($database->name);
            $database->delete();
        }
    }

    private function checkExistingDatabaseConfiguration(Site $site): void
    {
        try {
            $rawEnv = $site->getEnv($site->resolveEnvPath(), timeout: 8);
            if (empty($rawEnv)) {
                return;
            }

            $parsed = EnvParser::parse($rawEnv);
            $envMap = collect($parsed)->pluck('value', 'key')->filter(fn ($v) => $v !== '' && $v !== null)->all();

            $dbDatabase = trim((string) ($envMap['DB_DATABASE'] ?? ''));
            $dbUsername = trim((string) ($envMap['DB_USERNAME'] ?? ''));
            $dbHost = trim((string) ($envMap['DB_HOST'] ?? ''));
            $dbPassword = trim((string) ($envMap['DB_PASSWORD'] ?? ''));

            $hasDbConfig = (! empty($dbDatabase) && ! in_array(strtolower($dbDatabase), ['null', '""', "''"]))
                || (! empty($dbUsername) && ! in_array(strtolower($dbUsername), ['null', '""', "''"]))
                || (! empty($dbPassword))
                || (! empty($dbHost) && ! in_array(strtolower($dbHost), ['127.0.0.1', 'localhost', 'null', '""', "''"]));

            if ($hasDbConfig) {
                $details = [];
                foreach (['DB_CONNECTION', 'DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USERNAME'] as $k) {
                    if (! empty($envMap[$k])) {
                        $details[] = "{$k}={$envMap[$k]}";
                    }
                }
                $detailsStr = implode(', ', $details);

                throw ValidationException::withMessages([
                    'server_id' => __('Bu sitede mevcut veritabanı yapılandırması bulundu (:details). Otomatik veritabanı bağlamadan önce mevcut DB ayarlarını kontrol ediniz veya .env dosyasından kaldırınız.', [
                        'details' => $detailsStr ?: 'DB_DATABASE / DB_USERNAME',
                    ]),
                ]);
            }
        } catch (ValidationException $e) {
            throw $e;
        } catch (\Throwable) {
            // Ignore connection errors
        }
    }
}
