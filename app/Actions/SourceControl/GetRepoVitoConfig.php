<?php

namespace App\Actions\SourceControl;

use App\Models\SourceControl;
use App\Traits\ParsesVitoLimits;

class GetRepoVitoConfig
{
    use ParsesVitoLimits;

    /**
     * @return array{
     *     exists: bool,
     *     path: ?string,
     *     config: ?array,
     *     raw: ?string,
     *     error: ?string
     * }
     */
    public function get(SourceControl $sourceControl, string $repo, ?string $branch = null): array
    {
        $provider = $sourceControl->provider();

        $content = $provider->getFile($repo, 'vito.json', $branch);
        $foundPath = 'vito.json';

        if ($content === null) {
            $content = $provider->getFile($repo, '.vito.json', $branch);
            $foundPath = '.vito.json';
        }

        if ($content === null) {
            return [
                'exists' => false,
                'path' => null,
                'config' => null,
                'raw' => null,
                'error' => null,
            ];
        }

        $parsed = json_decode($content, true);

        if (! is_array($parsed)) {
            return [
                'exists' => true,
                'path' => $foundPath,
                'config' => null,
                'raw' => $content,
                'error' => 'File '.$foundPath.' contains invalid JSON.',
            ];
        }

        return [
            'exists' => true,
            'path' => $foundPath,
            'config' => $this->normalizeConfig($parsed),
            'raw' => $content,
            'error' => null,
        ];
    }

    private function normalizeConfig(array $config): array
    {
        $installCommands = [];
        if (isset($config['install_commands']) && is_array($config['install_commands'])) {
            $installCommands = array_values(array_filter($config['install_commands'], 'is_string'));
        }

        $commands = [];
        if (isset($config['commands']) && is_array($config['commands'])) {
            $commands = array_values(array_filter($config['commands'], 'is_string'));
        } elseif (isset($config['install'])) {
            $commands = is_array($config['install'])
                ? array_values(array_filter($config['install'], 'is_string'))
                : (is_string($config['install']) ? [$config['install']] : []);
        }

        $crons = [];
        if (isset($config['crons']) && is_array($config['crons'])) {
            foreach ($config['crons'] as $cron) {
                if (is_array($cron) && ! empty($cron['command'])) {
                    $crons[] = [
                        'name' => $cron['name'] ?? null,
                        'command' => $cron['command'],
                        'frequency' => $cron['frequency'] ?? '* * * * *',
                    ];
                }
            }
        }

        $workers = [];
        if (isset($config['workers']) && is_array($config['workers'])) {
            foreach ($config['workers'] as $worker) {
                if (is_array($worker) && ! empty($worker['name']) && ! empty($worker['command'])) {
                    $workers[] = [
                        'name' => $worker['name'],
                        'command' => $worker['command'],
                        'numprocs' => (int) ($worker['numprocs'] ?? 1),
                    ];
                }
            }
        }

        $limits = $this->extractVitoLimits($config);

        return [
            'name' => isset($config['name']) && is_string($config['name']) ? $config['name'] : null,
            'type' => isset($config['type']) && is_string($config['type']) ? $config['type'] : 'laravel',
            'php_version' => isset($config['php_version']) && is_string($config['php_version']) ? $config['php_version'] : null,
            'node_version' => isset($config['node_version']) && is_string($config['node_version']) ? $config['node_version'] : null,
            'web_directory' => isset($config['web_directory']) && is_string($config['web_directory']) ? $config['web_directory'] : 'public',
            'package_manager' => isset($config['package_manager']) && is_string($config['package_manager']) ? $config['package_manager'] : 'composer',
            'install_commands' => $installCommands,
            'commands' => $commands,
            'crons' => $crons,
            'workers' => $workers,
            'limits' => ! empty($limits) ? $limits : null,
            'environment' => $config['environment'] ?? ($config['env'] ?? null),
            'database' => $config['database'] ?? null,
        ];
    }
}
