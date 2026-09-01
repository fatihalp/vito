<?php

namespace App\Actions\Site;

use App\Actions\SiteResource\SyncManagedEnvironment;
use App\Exceptions\SSHError;
use App\Helpers\EnvParser;
use App\Models\Site;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class UpdateEnv
{
    public function __construct(private SyncManagedEnvironment $managedEnvironment) {}

    
    public function update(Site $site, array $input): void
    {
        Validator::make($input, [
            'env' => ['nullable', 'string'],
            'variables' => ['nullable', 'array', 'min:1'],
            'variables.*.key' => ['required_with:variables', 'string'],
            'variables.*.value' => ['nullable', 'string'],
            'variables.*.is_secret' => ['nullable', 'boolean'],
            'path' => ['nullable', 'string'],
        ])->validate();

        $hasVariables = array_key_exists('variables', $input)
            && is_array($input['variables'])
            && $input['variables'] !== [];

        $hasEnv = array_key_exists('env', $input)
            && ($input['env'] !== null || ! array_key_exists('variables', $input));

        if (! $hasEnv && ! $hasVariables) {
            throw ValidationException::withMessages([
                'env' => __('Either raw content or variables must be provided.'),
            ]);
        }

        if ($hasEnv && $hasVariables) {
            throw ValidationException::withMessages([
                'env' => __('Provide either raw content or variables, not both.'),
            ]);
        }

        $path = $site->resolveEnvPath($input['path'] ?? null);

        $variables = $this->resolveVariables($site, $input, $path, $hasVariables);
        $hasManagedVariables = $path === $site->resolveEnvPath()
            && $this->managedEnvironment->managed($site->loadMissing('resources')) !== [];
        if ($hasManagedVariables) {
            $variables = $this->managedEnvironment->enforce($site, $variables);
        }

        if ($hasVariables) {
            $existingRaw = $site->getEnv($path);
            if ($existingRaw !== '') {
                $liveParsed = EnvParser::parse($existingRaw);
                $liveKeys = array_column($liveParsed, 'key');
                $incomingKeys = array_column($variables, 'key');
                $removedKeys = array_diff($liveKeys, $incomingKeys);

                $patchValues = [];
                foreach ($variables as $var) {
                    $patchValues[$var['key']] = $var['value'];
                }
                foreach ($removedKeys as $removedKey) {
                    $patchValues[$removedKey] = null;
                }

                $content = EnvParser::patch($existingRaw, $patchValues);
                if ($hasManagedVariables) {
                    $content = $this->managedEnvironment->enforceRaw($site, $content);
                }
            } else {
                $content = EnvParser::stringify($variables);
            }
        } else {
            $content = $hasManagedVariables
                ? $this->managedEnvironment->enforceRaw($site, trim((string) ($input['env'] ?? null)))
                : trim((string) ($input['env'] ?? null));

            $variables = $this->resolveVariables($site, ['env' => $content], $path, false);
        }

        $site->server->os()->write($path, $content, $site->user);

        $site->env_variables = $this->secretKeys($variables);
        $site->jsonUpdate('type_data', 'env_path', $path, save: false);
        $site->save();
    }

    
    private function resolveVariables(Site $site, array $input, string $path, bool $hasVariables): array
    {
        $secretKeys = array_flip(EnvParser::secretKeys($site->env_variables));

        if ($hasVariables) {
            $live = EnvParser::parse($site->getEnv($path));

            $this->guardAgainstWipingSecrets($input['variables'], $live, $secretKeys);

            $incoming = array_map(function ($var) use ($secretKeys): array {
                $key = $var['key'] ?? '';
                $value = $var['value'] ?? '';
                $isSecret = (bool) ($var['is_secret'] ?? false);

                if ($value === '' && isset($secretKeys[$key])) {
                    $isSecret = true;
                }

                return [
                    'key' => $key,
                    'value' => $value,
                    'is_secret' => $isSecret,
                ];
            }, $input['variables']);

            return EnvParser::mergeWithLive($incoming, $live);
        }

        return array_map(function ($variable) use ($secretKeys) {
            $variable['is_secret'] = $variable['is_secret'] || isset($secretKeys[$variable['key']]);

            return $variable;
        }, EnvParser::parse(trim((string) ($input['env'] ?? null))));
    }

    
    private function guardAgainstWipingSecrets(array $incoming, array $live, array $secretKeys): void
    {
        if ($live !== []) {
            return;
        }

        foreach ($incoming as $var) {
            $key = $var['key'] ?? '';
            $isEmpty = ($var['value'] ?? '') === '';

            if ($isEmpty && isset($secretKeys[$key])) {
                throw ValidationException::withMessages([
                    'variables' => __('Could not read the current .env file from the server to preserve secret values. Please try again.'),
                ]);
            }
        }
    }

    
    private function secretKeys(array $variables): array
    {
        $keys = [];

        foreach ($variables as $variable) {
            if ($variable['is_secret'] && $variable['key'] !== '') {
                $keys[] = $variable['key'];
            }
        }

        return array_values(array_unique($keys));
    }
}
