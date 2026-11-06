<?php

namespace App\Actions\SiteResource;

use App\Actions\Database\BrowsePostgresDatabase;
use App\Enums\SiteResourceStatus;
use App\Enums\SiteResourceType;
use App\Helpers\EnvParser;
use App\Models\Database;
use App\Models\Server;
use App\Models\Site;
use App\Models\SiteResource;
use App\Models\StorageProvider;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RegisterExistingSiteResource
{
    public function register(Site $site, array $input): SiteResource
    {
        $data = Validator::make($input, [
            'type' => ['required', Rule::enum(SiteResourceType::class)],
            'server_id' => ['nullable', 'integer'],
            'storage_provider_id' => ['nullable', 'integer'],
            'database_name' => ['nullable', 'string', 'max:63'],
            'runtime_driver' => ['nullable', Rule::in(['native', 'docker'])],
            'container' => ['nullable', 'string', 'regex:/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/'],
        ])->validate();
        $type = SiteResourceType::from($data['type']);
        $configuration = ['management_mode' => 'observed'];
        $environment = [];
        $admin = auth()->user()?->isAdmin() ?? false;
        $server = $type === SiteResourceType::STORAGE ? null : Server::query()
            ->when(! $admin, fn ($query) => $query->where('project_id', $site->server->project_id))
            ->findOrFail($data['server_id']);
        $storage = $type === SiteResourceType::STORAGE
            ? ($admin ? StorageProvider::query() : StorageProvider::getByProjectId($site->server->project_id, auth()->user()))->findOrFail($data['storage_provider_id'])
            : null;

        if ($type === SiteResourceType::STORAGE) {
            $raw = $site->getEnv($site->resolveEnvPath(), timeout: 8);
            $values = collect(EnvParser::parse($raw))->pluck('value', 'key')->all();
            $bucket = $storage->credentials['bucket'] ?? null;
            $environment = array_filter($values, fn ($value, $key) => preg_match('/(?:^|_)BUCKET(?:$|_)/', $key) === 1 && $value === $bucket, ARRAY_FILTER_USE_BOTH);
            if ($environment === []) {
                throw ValidationException::withMessages(['storage_provider_id' => __('This bucket was not found in the existing application configuration.')]);
            }
        }

        if ($type === SiteResourceType::DATABASE || $type === SiteResourceType::CACHE) {
            $raw = $site->getEnv($site->resolveEnvPath(), timeout: 8);
            $environment = collect(EnvParser::parse($raw))->pluck('value', 'key')->all();
            $keys = $type === SiteResourceType::DATABASE
                ? ['DB_CONNECTION', 'DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USERNAME']
                : ['REDIS_HOST', 'REDIS_PORT'];
            $environment = array_intersect_key($environment, array_flip($keys));
        }

        if ($type === SiteResourceType::DATABASE) {
            $name = $data['database_name'] ?? $environment['DB_DATABASE'] ?? '';
            if ($name === '' || $name !== ($environment['DB_DATABASE'] ?? null)) {
                throw ValidationException::withMessages(['database_name' => __('Select the database already configured in the application environment.')]);
            }
            $configuration['database_name'] = $name;
            if (($data['runtime_driver'] ?? 'native') === 'docker') {
                if (empty($data['container']) || empty($environment['DB_USERNAME'])) {
                    throw ValidationException::withMessages(['container' => __('Select the existing PostgreSQL container and configure the application database username.')]);
                }
                $configuration['runtime'] = ['driver' => 'docker', 'container' => $data['container'], 'username' => $environment['DB_USERNAME']];
            } else {
                $database = Database::query()->where('server_id', $server->id)->where('name', $name)->first();
                if (! $database) {
                    throw ValidationException::withMessages(['database_name' => __('Import the existing database into the server database list first.')]);
                }
                $configuration['database_id'] = $database->id;
            }
        }

        if ($type === SiteResourceType::CACHE && (empty($environment['REDIS_HOST']) || ! $server->memoryDatabase())) {
            throw ValidationException::withMessages(['server_id' => __('The existing application Redis connection could not be identified.')]);
        }

        $resource = new SiteResource([
            'site_id' => $site->id,
            'server_id' => $server?->id,
            'storage_provider_id' => $storage?->id,
            'type' => $type,
            'status' => SiteResourceStatus::READY,
            'configuration' => $configuration,
            'environment' => $environment,
            'original_environment' => [],
        ]);
        if ($type === SiteResourceType::DATABASE) {
            $resource->setRelation('server', $server);
            app(BrowsePostgresDatabase::class)->resource($resource, []);
        }
        $resource->save();

        return $resource;
    }
}
