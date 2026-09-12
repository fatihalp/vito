<?php

namespace App\SiteTypes;

use App\Actions\CronJob\CreateCronJob;
use App\Actions\Site\UpdatePHPSettings;
use App\Actions\Worker\CreateWorker;
use App\DTOs\SocketEventDTO;
use App\Enums\DeploymentStatus;
use App\Events\SocketEvent;
use App\Exceptions\SSHCommandError;
use App\Http\Resources\DeploymentResource;
use App\Models\Deployment;
use App\Models\ServerLog;
use App\Models\Site;
use App\Models\SourceControl;
use App\SSH\OS\Composer;
use App\Tooling\ToolingRegistry;
use App\Traits\NormalizesWebDirectory;
use App\Traits\ParsesVitoLimits;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Throwable;

class VitoSite extends PHPSite
{
    use NormalizesWebDirectory;
    use ParsesVitoLimits;
    public static function id(): string
    {
        return 'vito';
    }

    public static function make(): self
    {
        return new self(new Site(['type' => self::id()]));
    }

    public function language(): string
    {
        $config = $this->resolveVitoConfig();
        $type = $config['type'] ?? 'php';

        return match ($type) {
            'node', 'nodejs', 'bun' => 'javascript',
            'static', 'html', 'blank' => 'html',
            default => 'php',
        };
    }

    public function requiredServices(): array
    {
        $config = $this->resolveVitoConfig();
        $type = $config['type'] ?? 'php';

        if (in_array($type, ['node', 'nodejs', 'bun', 'static', 'html', 'blank'], true)) {
            return ['webserver'];
        }

        return [
            'php',
            'webserver',
        ];
    }

    public function createRules(array $input): array
    {
        $serverPhps = $this->site->server->installedPHPVersions();
        $rules = [
            'source_control' => SourceControl::siteValidationRules($this->site->server),
            'repository' => [
                'required',
                'string',
            ],
            'branch' => [
                'required',
                'string',
            ],
            'php_version' => [
                'nullable',
                Rule::in(array_merge(['none'], $serverPhps)),
            ],
            'web_directory' => [
                'nullable',
                'string',
                'max:255',
                'regex:/^[a-zA-Z0-9._\-\/]+$/',
                'not_regex:/\.\./',
            ],
            'package_manager' => [
                'nullable',
                'string',
            ],
            'vito_config' => [
                'nullable',
                'array',
            ],
        ];

        foreach (static::createTimeTools() as $toolId) {
            $tool = ToolingRegistry::find($toolId);
            if (! $tool) {
                continue;
            }
            $rules[$tool::typeDataKey()] = [
                'nullable',
                Rule::in($tool::supportedVersionsWithNone()),
            ];
        }

        return $rules;
    }

    public function createFields(array $input): array
    {
        $vitoConfig = $input['vito_config'] ?? [];

        $phpVersion = $input['php_version']
            ?? ($vitoConfig['php_version']
            ?? $this->site->server->installedPHPVersions()[0] ?? null);

        $webDirectory = $input['web_directory']
            ?? ($vitoConfig['web_directory'] ?? 'public');

        return [
            'web_directory' => $this->normalizeWebDirectory($webDirectory),
            'source_control_id' => $input['source_control'] ?? '',
            'repository' => $input['repository'] ?? '',
            'branch' => $input['branch'] ?? 'main',
            'php_version' => $phpVersion ?? '',
        ];
    }

    public function data(array $input): array
    {
        $parentData = parent::data($input);

        $vitoConfig = $input['vito_config'] ?? [];

        if (is_array($vitoConfig)) {
            $limits = $this->extractVitoLimits($vitoConfig);
            if (! empty($limits)) {
                $parentData['php'] = array_merge($parentData['php'] ?? [], $limits);
            }
        }

        return array_merge($parentData, [
            'vito_config' => $vitoConfig,
        ]);
    }

    public function install(): void
    {
        $this->progress(0, 'isolating-user');
        $this->isolate();

        $this->progress(15, 'installing-tooling');
        $this->setupRequestedTooling();

        $this->progress(20, 'creating-vhost');
        $this->site->webserver()->createVHost($this->site);

        $this->progress(25, 'deploying-ssh-key');
        $this->deployKey();

        $this->progress(40, 'cloning-repository');
        $this->cloneRepository();

        $this->progress(60, 'restarting-php');
        $this->site->php()?->restart();

        $this->progress(70, 'running-auto-install');
        $this->runAutoInstall();

        $this->progress(100, 'finishing');
    }

    protected function runAutoInstall(): void
    {
        $config = $this->resolveVitoConfig();

        if (empty($config)) {
            return;
        }

        $this->ensureEnvironmentFile($config);

        $commands = $config['commands'] ?? [];
        if (! empty($commands)) {
            $this->applyDeploymentScript($commands);
        }

        $installCommands = $config['install_commands'] ?? [];
        if (! empty($installCommands) || ! empty($commands)) {
            $this->executeAutoInstall($installCommands, $commands);
        }

        $this->setupLimits($config);
        $this->setupCronJobs($config['crons'] ?? []);
        $this->setupWorkers($config['workers'] ?? []);
    }

    private function setupLimits(array $config): void
    {
        $limits = $this->extractVitoLimits($config);
        if (empty($limits)) {
            return;
        }

        try {
            app(UpdatePHPSettings::class)->update($this->site, $limits);
        } catch (Throwable $e) {
            Log::warning("Failed to apply PHP/Nginx limits for site #{$this->site->id}: {$e->getMessage()}");
        }
    }

    private function resolveVitoConfig(): array
    {
        $diskConfig = [];
        try {
            $sitePath = escapeshellarg($this->site->path);
            $output = trim($this->site->server->ssh($this->site->user)->exec(
                "if [ -f {$sitePath}/vito.json ]; then cat {$sitePath}/vito.json; elif [ -f {$sitePath}/.vito.json ]; then cat {$sitePath}/.vito.json; fi"
            ));

            if (! empty($output)) {
                $decoded = json_decode($output, true);
                if (is_array($decoded)) {
                    $diskConfig = $decoded;
                }
            }
        } catch (Throwable $e) {
            Log::warning("Failed to read vito.json from server for site #{$this->site->id}: {$e->getMessage()}");
        }

        $typeDataConfig = $this->site->type_data['vito_config'] ?? [];
        if (! is_array($typeDataConfig)) {
            $typeDataConfig = [];
        }

        $merged = array_merge($typeDataConfig, $diskConfig);
        if (! empty($merged)) {
            if (! empty($diskConfig) && $merged !== $typeDataConfig) {
                $this->site->jsonUpdate('type_data', 'vito_config', $merged);
            }

            return $merged;
        }

        return [];
    }

    private function ensureEnvironmentFile(array $config): void
    {
        try {
            $sitePath = escapeshellarg($this->site->path);
            $this->site->server->ssh($this->site->user)->exec(
                "if [ ! -f {$sitePath}/.env ] && [ -f {$sitePath}/.env.example ]; then cp {$sitePath}/.env.example {$sitePath}/.env; fi",
                'ensure-env-file',
                $this->site->id
            );

            if (! empty($config['environment']) && is_array($config['environment'])) {
                $envLines = [];
                foreach ($config['environment'] as $key => $val) {
                    $envLines[] = escapeshellarg("{$key}={$val}");
                }
                if (! empty($envLines)) {
                    $appendCmd = 'echo '.implode(' >> '.$sitePath.'/.env && echo ', $envLines).' >> '.$sitePath.'/.env';
                    $this->site->server->ssh($this->site->user)->exec($appendCmd, 'append-env', $this->site->id);
                }
            }
        } catch (Throwable $e) {
            Log::warning("Could not setup environment file for site #{$this->site->id}: {$e->getMessage()}");
        }
    }

    private function executeAutoInstall(array $installCommands, array $commands): void
    {
        $log = ServerLog::newLog($this->site->server, 'install-commands')
            ->forSite($this->site);
        $log->save();

        $deployment = null;
        try {
            $deployment = new Deployment([
                'site_id' => $this->site->id,
                'deployment_script_id' => $this->site->deploymentScript?->id,
                'log_id' => $log->id,
                'status' => DeploymentStatus::DEPLOYING,
                'active' => true,
            ]);
            $lastCommit = $this->site->sourceControl?->provider()?->getLastCommit($this->site->repository, $this->site->branch);
            if ($lastCommit) {
                $deployment->commit_id = $lastCommit['commit_id'];
                $deployment->commit_data = $lastCommit['commit_data'];
            } else {
                $deployment->commit_data = ['message' => 'Initial installation'];
            }
            $deployment->save();

            SocketEvent::dispatch(new SocketEventDTO(
                projectId: $this->site->server->project_id,
                type: 'deployment.created',
                data: new DeploymentResource($deployment),
            ));
        } catch (Throwable $e) {
            Log::warning("Could not create initial deployment for site #{$this->site->id}: {$e->getMessage()}");
        }

        $sitePath = escapeshellarg($this->site->path);

        try {
            if (! empty($installCommands)) {
                $log->write("=== Running Install Commands ===\n");
                $this->runCommandList($installCommands, $sitePath, $log);
            }

            if (! empty($commands)) {
                $log->write("\n=== Running Deployment Commands ===\n");
                $this->runCommandList($commands, $sitePath, $log);
            }

            $log->write("\nInstallation completed successfully.\n");

            if ($deployment) {
                $deployment->status = DeploymentStatus::FINISHED;
                $deployment->save();

                SocketEvent::dispatch(new SocketEventDTO(
                    projectId: $this->site->server->project_id,
                    type: 'deployment.updated',
                    data: new DeploymentResource($deployment),
                ));
            }
        } catch (SSHCommandError $e) {
            $log->write("\nCommand failed: {$e->getMessage()}\n");

            if ($deployment) {
                $deployment->status = DeploymentStatus::FAILED;
                $deployment->save();

                SocketEvent::dispatch(new SocketEventDTO(
                    projectId: $this->site->server->project_id,
                    type: 'deployment.updated',
                    data: new DeploymentResource($deployment),
                ));
            }

            throw $e;
        }
    }

    private function runCommandList(array $commands, string $sitePath, ServerLog $log): void
    {
        foreach ($commands as $command) {
            if (! is_string($command) || trim($command) === '') {
                continue;
            }

            $log->write("\n$ {$command}\n");

            $ssh = $this->site->server->ssh($this->site->user);
            $ssh->setLog($log);

            $ssh->exec(
                "cd {$sitePath} && {$command}",
                'install-commands',
                $this->site->id
            );
        }
    }

    private function applyDeploymentScript(array $commands): void
    {
        try {
            $script = implode("\n", $commands);
            $this->site->deploymentScript()->updateOrCreate(
                ['site_id' => $this->site->id],
                ['content' => "cd {$this->site->path}\n\n".$script]
            );
        } catch (Throwable $e) {
            Log::warning("Failed to save deployment script for site #{$this->site->id}: {$e->getMessage()}");
        }
    }

    private function setupCronJobs(array $crons): void
    {
        foreach ($crons as $cron) {
            if (! is_array($cron) || empty($cron['command'])) {
                continue;
            }

            try {
                app(CreateCronJob::class)->create($this->site->server, [
                    'name' => $cron['name'] ?? null,
                    'command' => $cron['command'],
                    'frequency' => $cron['frequency'] ?? '* * * * *',
                    'user' => $this->site->user,
                ], $this->site);
            } catch (Throwable $e) {
                Log::warning("Failed to create cron for site #{$this->site->id}: {$e->getMessage()}");
            }
        }
    }

    private function setupWorkers(array $workers): void
    {
        foreach ($workers as $worker) {
            if (! is_array($worker) || empty($worker['command'])) {
                continue;
            }

            try {
                app(CreateWorker::class)->create($this->site->server, [
                    'name' => $worker['name'] ?? 'Worker',
                    'command' => $worker['command'],
                    'user' => $this->site->user,
                    'auto_start' => true,
                    'auto_restart' => true,
                    'numprocs' => (int) ($worker['numprocs'] ?? 1),
                ], $this->site);
            } catch (Throwable $e) {
                Log::warning("Failed to create worker for site #{$this->site->id}: {$e->getMessage()}");
            }
        }
    }
}
