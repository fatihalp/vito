<?php

namespace App\Actions\Site;

use App\Actions\SiteResource\SyncManagedEnvironment;
use App\Exceptions\SSHError;
use App\Helpers\EnvParser;
use App\Models\Site;
use Illuminate\Validation\ValidationException;

class GetEnv
{
    public function __construct(private SyncManagedEnvironment $managedEnvironment) {}

    /**
     * Read the live .env file and return its variables classified against the
     * persisted secret keys. Raw content and real secret values are returned
     * only when the caller is allowed to write them back; everyone else gets
     * masked variables and no raw content at all.
     *
     * @return array{env?: string, variables: array<int, array{key: string, value: string, is_secret: bool, managed_by?: string}>}
     *
     * @throws SSHError
     * @throws ValidationException
     */
    public function get(Site $site, ?string $path = null, bool $reveal = false): array
    {
        $resolvedPath = $site->resolveEnvPath($path);
        $env = $site->server->os()->readFile($resolvedPath);

        $variables = EnvParser::classify(EnvParser::parse($env), $site->env_variables);
        $managed = $resolvedPath === $site->resolveEnvPath()
            ? $this->managedEnvironment->managed($site->loadMissing('resources'))
            : [];
        $variables = array_map(function (array $variable) use ($managed): array {
            $resource = $managed[$variable['key']]['resource'] ?? null;

            return $resource ? [...$variable, 'managed_by' => $resource] : $variable;
        }, $variables);

        if (! $reveal) {
            return ['variables' => EnvParser::maskSecrets($variables)];
        }

        return [
            'env' => $env,
            'variables' => $variables,
        ];
    }
}
