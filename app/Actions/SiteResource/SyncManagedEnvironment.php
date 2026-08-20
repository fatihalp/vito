<?php

namespace App\Actions\SiteResource;

use App\Helpers\EnvParser;
use App\Models\Site;
use App\Models\SiteResource;
use App\Enums\SiteResourceStatus;

class SyncManagedEnvironment
{
    /**
     * @return array<string, array{value: string, resource: string}>
     */
    public function managed(Site $site): array
    {
        $managed = [];

        foreach ($site->resources as $resource) {
            if ($resource->status !== SiteResourceStatus::READY) {
                continue;
            }

            foreach ($resource->environment as $key => $value) {
                $managed[$key] = [
                    'value' => $value,
                    'resource' => $resource->type->getText(),
                ];
            }
        }

        return $managed;
    }

    public function sync(Site $site, ?SiteResource $removed = null): void
    {
        $path = $site->resolveEnvPath();
        $raw = $site->server->os()->readFile($path);
        $changes = [];

        if ($removed) {
            foreach (array_keys($removed->environment) as $key) {
                if (array_key_exists($key, $removed->original_environment ?? [])) {
                    $changes[$key] = $removed->original_environment[$key];
                }
            }
        }

        $site->unsetRelation('resources');
        foreach ($this->managed($site->load('resources')) as $key => $managed) {
            $changes[$key] = $managed['value'];
        }

        $site->server->os()->write(
            $path,
            EnvParser::patch($raw, $changes),
            $site->user,
        );

        $secretKeys = array_values(array_diff(
            EnvParser::secretKeys($site->env_variables),
            array_keys($removed->environment ?? []),
        ));
        $secretKeys = array_merge(
            $secretKeys,
            $removed?->configuration['original_secret_keys'] ?? [],
        );
        foreach (array_keys($this->managed($site)) as $key) {
            if (EnvParser::isSecretKey($key)) {
                $secretKeys[] = $key;
            }
        }

        $site->env_variables = array_values(array_unique($secretKeys));
        $site->save();
    }

    /**
     * @param array<int, array{key: string, value: string, is_secret: bool}> $variables
     * @return array<int, array{key: string, value: string, is_secret: bool}>
     */
    public function enforce(Site $site, array $variables): array
    {
        $managed = $this->managed($site->loadMissing('resources'));
        $map = [];

        foreach ($variables as $variable) {
            if (! isset($managed[$variable['key']])) {
                $map[$variable['key']] = $variable;
            }
        }

        foreach ($managed as $key => $item) {
            $map[$key] = [
                'key' => $key,
                'value' => $item['value'],
                'is_secret' => EnvParser::isSecretKey($key),
            ];
        }

        return array_values($map);
    }

    public function enforceRaw(Site $site, string $raw): string
    {
        $values = collect($this->managed($site->loadMissing('resources')))
            ->mapWithKeys(fn (array $item, string $key): array => [$key => $item['value']])
            ->all();

        return EnvParser::patch($raw, $values);
    }
}
