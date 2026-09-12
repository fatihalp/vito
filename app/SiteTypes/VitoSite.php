<?php

namespace App\SiteTypes;

use App\Actions\CronJob\CreateCronJob;
use App\Actions\Site\UpdatePHPSettings;
use App\Actions\Worker\CreateWorker;
use App\DTOs\SocketEventDTO;
use App\Actions\SiteResource\ConnectSiteResource;
use App\Enums\DeploymentStatus;
use App\Enums\ServiceStatus;
use App\Enums\SiteResourceType;
use App\Events\SocketEvent;
use App\Exceptions\SSHCommandError;
use App\Helpers\EnvParser;
use App\Http\Resources\DeploymentResource;
use App\Jobs\Service\UpdateVitoAgentConfigJob;
use App\Models\Deployment;
use App\Models\Server;
use App\Models\ServerLog;
use App\Models\Service;
use App\Models\Site;
use App\Models\SourceControl;
use RuntimeException;
use App\SSH\OS\Composer;
use App\SSH\OS\Git;
use App\Tooling\ComposerTooling;
use App\Tooling\SiteToolingState;
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
        $this->step('isolating-user', 0, fn () => $this->isolate());
        $this->step('installing-tooling', 15, fn () => $this->setupRequestedTooling());
        $this->step('creating-vhost', 20, fn () => $this->site->webserver()->createVHost($this->site));
        $this->step('deploying-ssh-key', 25, fn () => $this->deployKey());
        $this->step('cloning-repository', 40, fn () => $this->cloneRepository());
        $this->step('restarting-php', 60, fn () => $this->site->php()?->restart());
        $this->step('running-auto-install', 70, fn () => $this->runAutoInstall());

        $this->progress(100, 'finishing');
    }

    public function installationSteps(): array
    {
        return [
            ['key' => 'isolating-user', 'label' => 'Isolating User & Environment', 'percentage' => 0],
            ['key' => 'installing-tooling', 'label' => 'Installing Runtime Tooling', 'percentage' => 15],
            ['key' => 'creating-vhost', 'label' => 'Configuring Web Server VHost', 'percentage' => 20],
            ['key' => 'deploying-ssh-key', 'label' => 'Deploying Repository SSH Key', 'percentage' => 25],
            ['key' => 'cloning-repository', 'label' => 'Cloning Source Code', 'percentage' => 40],
            ['key' => 'restarting-php', 'label' => 'Restarting PHP Runtime', 'percentage' => 60],
            ['key' => 'running-auto-install', 'label' => 'Auto-Install & Services', 'percentage' => 70],
            ['key' => 'finishing', 'label' => 'Finalizing & Verifying', 'percentage' => 100],
        ];
    }

    protected function runAutoInstall(): void
    {
        $config = $this->resolveVitoConfig(refreshFromDisk: true);

        if (empty($config)) {
            return;
        }

        $log = ServerLog::newLog($this->site->server, 'install-commands')
            ->forSite($this->site);
        $log->save();

        $this->ensureEnvironmentFile($config, $log);
        $this->setupDatabase($config, $log);

        $commands = $config['commands'] ?? [];
        if (! empty($commands)) {
            $this->applyDeploymentScript($commands);
        }

        $installCommands = $config['install_commands'] ?? [];
        if (! empty($installCommands) || ! empty($commands)) {
            $this->executeAutoInstall($installCommands, $commands, $log);
        }

        $this->setupLimits($config);
        $this->setupCronJobs($config['crons'] ?? []);
        $this->setupWorkers($config['workers'] ?? []);
    }

    private function setupDatabase(array $config, ?ServerLog $log = null): void
    {
        $server = $this->site->server;

        if ($this->site->resources()->where('type', SiteResourceType::DATABASE->value)->exists()) {
            $log?->write("Database resource is already connected to site #{$this->site->id}, skipping.\n");

            return;
        }

        $dbConfig = $config['database'] ?? null;
        if ($dbConfig === false || $dbConfig === 'none') {
            return;
        }

        $commands = array_merge($config['install_commands'] ?? [], $config['commands'] ?? []);
        $hasMigrate = false;
        foreach ($commands as $cmd) {
            if (is_string($cmd) && (str_contains($cmd, 'migrate') || str_contains($cmd, 'alobot:install') || str_contains($cmd, 'db:seed'))) {
                $hasMigrate = true;
                break;
            }
        }

        $isLaravel = ($config['type'] ?? '') === 'laravel';
        if (! $dbConfig && ! $hasMigrate && ! $isLaravel) {
            return;
        }

        $service = $server->database();
        if (! $service) {
            $driver = $this->detectDatabaseDriver($config);
            $log?->write("No database service found on server #{$server->id}. Automatically installing {$driver}...\n");
            $service = $this->autoInstallDatabaseService($server, $driver, $log);
            if (! $service) {
                $msg = "Server #{$server->id} has no database service and auto-installation of {$driver} failed.";
                $log?->write("Error: {$msg}\n");

                throw new RuntimeException($msg);
            }
            $server->unsetRelation('services');
        }

        $dbName = is_string($dbConfig) && trim($dbConfig) !== ''
            ? trim($dbConfig)
            : (is_array($dbConfig) && ! empty($dbConfig['name']) ? trim($dbConfig['name']) : ($this->detectDatabaseNameFromEnv() ?? 'site_'.$this->site->id));

        $dbName = preg_replace('/[^a-zA-Z0-9_]/', '_', $dbName);

        $log?->write("Auto-provisioning database '{$dbName}' on server #{$server->id}...\n");

        try {
            app(ConnectSiteResource::class)->connect($this->site, [
                'type' => SiteResourceType::DATABASE->value,
                'server_id' => $server->id,
                'database_name' => $dbName,
                'confirm_overwrite' => true,
            ]);

            $log?->write("Database '{$dbName}' successfully provisioned and connected.\n\n");
        } catch (Throwable $e) {
            $errorMsg = "Failed to auto-provision database '{$dbName}' for site #{$this->site->id}: {$e->getMessage()}";
            $log?->write("Error: {$errorMsg}\n");
            Log::error($errorMsg, ['exception' => $e]);

            throw new RuntimeException($errorMsg, previous: $e);
        }
    }

    private function detectDatabaseDriver(array $config): string
    {
        $dbConfig = $config['database'] ?? null;
        if (is_array($dbConfig) && ! empty($dbConfig['type'])) {
            $type = strtolower((string) $dbConfig['type']);
            if (in_array($type, ['pgsql', 'postgres', 'postgresql'], true)) {
                return 'postgresql';
            }
            if (in_array($type, ['mysql', 'mariadb'], true)) {
                return 'mysql';
            }
        }

        if (is_string($dbConfig) && in_array(strtolower($dbConfig), ['postgresql', 'pgsql', 'postgres'], true)) {
            return 'postgresql';
        }

        try {
            $path = $this->site->resolveEnvPath();
            $raw = $this->site->getEnv($path);
            $parsed = EnvParser::parse($raw);
            $conn = strtolower((string) ($parsed['DB_CONNECTION']['value'] ?? ''));
            if (str_contains($conn, 'pgsql') || str_contains($conn, 'postgres')) {
                return 'postgresql';
            }
            if (str_contains($conn, 'mysql') || str_contains($conn, 'mariadb')) {
                return 'mysql';
            }
        } catch (Throwable) {
        }

        return 'mysql';
    }

    private function autoInstallDatabaseService(Server $server, string $serviceName, ?ServerLog $log = null): ?Service
    {
        try {
            $version = (string) (config("service.services.{$serviceName}.versions")[0] ?? ($serviceName === 'postgresql' ? '17' : '8.4'));

            $service = new Service([
                'server_id' => $server->id,
                'name' => $serviceName,
                'type' => 'database',
                'version' => $version,
                'status' => ServiceStatus::INSTALLING,
                'is_default' => true,
            ]);
            $service->save();
            $service->newLog();

            $log?->write("Installing {$serviceName} {$version} on server #{$server->id}...\n");

            $handler = $service->handler();
            $handler->install();
            $service->status = ServiceStatus::READY;
            $service->installed_version = $handler->version();
            $service->save();

            UpdateVitoAgentConfigJob::dispatchFor($service);

            $log?->write("{$serviceName} {$version} installed successfully.\n");

            return $service;
        } catch (Throwable $e) {
            $log?->write("Failed to install {$serviceName}: {$e->getMessage()}\n");
            Log::error("Failed to auto-install {$serviceName} for server #{$server->id}: {$e->getMessage()}", ['exception' => $e]);

            return null;
        }
    }

    private function detectDatabaseNameFromEnv(): ?string
    {
        try {
            $path = $this->site->resolveEnvPath();
            $raw = $this->site->getEnv($path);
            $parsed = EnvParser::parse($raw);
            $dbName = $parsed['DB_DATABASE']['value'] ?? null;
            if (is_string($dbName) && trim($dbName) !== '' && ! in_array(trim($dbName), ['laravel', 'forge', 'database', ''], true)) {
                return trim($dbName);
            }
        } catch (Throwable) {
        }

        return null;
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

    private ?array $resolvedVitoConfig = null;

    private function resolveVitoConfig(bool $refreshFromDisk = false): array
    {
        if (! $refreshFromDisk && $this->resolvedVitoConfig !== null) {
            return $this->resolvedVitoConfig;
        }

        $typeDataConfig = $this->site->type_data['vito_config'] ?? [];
        if (! is_array($typeDataConfig)) {
            $typeDataConfig = [];
        }

        if (! $refreshFromDisk) {
            return $this->resolvedVitoConfig = $typeDataConfig;
        }

        $diskConfig = [];
        try {
            $sitePath = escapeshellarg($this->site->path);

            if ($this->repositoryAlreadyCloned()) {
                try {
                    app(Git::class)->fetchOrigin($this->site);
                    app(Git::class)->checkout($this->site);
                    $this->site->server->ssh($this->site->user)->exec(
                        "cd {$sitePath} && git reset --hard origin/".escapeshellarg((string) $this->site->branch)
                    );
                } catch (Throwable) {
                }
            }

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

        $merged = ! empty($diskConfig) ? array_replace($typeDataConfig, $diskConfig) : $typeDataConfig;
        if (! empty($merged)) {
            if (! empty($diskConfig) && $merged !== $typeDataConfig) {
                $this->site->jsonUpdate('type_data', 'vito_config', $merged);
            }

            return $this->resolvedVitoConfig = $merged;
        }

        return $this->resolvedVitoConfig = [];
    }

    private function ensureEnvironmentFile(array $config, ?ServerLog $log = null): void
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

            $log?->write("Environment file (.env) ready.\n");
        } catch (Throwable $e) {
            $log?->write("Warning: could not setup environment file: {$e->getMessage()}\n");
            Log::warning("Could not setup environment file for site #{$this->site->id}: {$e->getMessage()}");
        }
    }

    private function executeAutoInstall(array $installCommands, array $commands, ?ServerLog $log = null): void
    {
        if (! $log) {
            $log = ServerLog::newLog($this->site->server, 'install-commands')
                ->forSite($this->site);
            $log->save();
        }

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

        $hasComposer = false;
        foreach (array_merge($installCommands, $commands) as $cmd) {
            if (is_string($cmd) && str_contains($cmd, 'composer')) {
                $hasComposer = true;
                break;
            }
        }

        if ($hasComposer) {
            $this->ensureComposer($log);
        }

        $sitePath = escapeshellarg($this->site->path);

        try {
            if (! empty($installCommands)) {
                $log->write("=== Running Install Commands ===\n");
                $completedInstall = $this->site->type_data['completed_install_commands'] ?? [];
                if (! is_array($completedInstall)) {
                    $completedInstall = [];
                }

                foreach ($installCommands as $command) {
                    if (! is_string($command) || trim($command) === '') {
                        continue;
                    }

                    if (in_array($command, $completedInstall, true)) {
                        $log->write("\n$ {$command} (already completed, skipped)\n");
                        continue;
                    }

                    $this->runSingleCommand($command, $sitePath, $log);

                    $completedInstall[] = $command;
                    $this->site->jsonUpdate('type_data', 'completed_install_commands', array_values($completedInstall));
                }
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

    private function ensureComposer(ServerLog $log): void
    {
        try {
            $check = trim($this->site->server->ssh($this->site->user)->exec(
                'which composer 2>/dev/null || [ -f ~/.local/vito/bin/composer ] && echo "FOUND" || echo "NOT_FOUND"'
            ));

            if (! str_contains($check, 'FOUND') && ! str_contains($check, 'composer')) {
                $log->write("Composer not found. Installing Composer...\n");
                app(ComposerTooling::class)->install($this->site, '2');
                SiteToolingState::completeInstall($this->site, 'composer', '2');
                $log->write("Composer installed successfully.\n\n");
            }
        } catch (Throwable $e) {
            Log::warning("Could not verify/install Composer for site #{$this->site->id}: {$e->getMessage()}");
        }
    }

    private function runCommandList(array $commands, string $sitePath, ServerLog $log): void
    {
        $completedDeploy = $this->site->type_data['completed_deploy_commands'] ?? [];
        if (! is_array($completedDeploy)) {
            $completedDeploy = [];
        }

        foreach ($commands as $command) {
            if (! is_string($command) || trim($command) === '') {
                continue;
            }

            if (in_array($command, $completedDeploy, true)) {
                $log->write("\n$ {$command} (already completed, skipped)\n");
                continue;
            }

            $this->runSingleCommand($command, $sitePath, $log);

            $completedDeploy[] = $command;
            $this->site->jsonUpdate('type_data', 'completed_deploy_commands', array_values($completedDeploy));
        }
    }

    private function runSingleCommand(string $command, string $sitePath, ServerLog $log): void
    {
        $variables = array_merge(
            $this->site->environmentVariables(),
            $this->deploymentEnvironment(),
        );

        $aliases = $this->site->environmentAliases();
        $aliasPrefix = "shopt -s expand_aliases\n";
        foreach ($aliases as $key => $alias) {
            $aliasPrefix .= sprintf("alias %s=%s\n", $key, escapeshellarg((string) $alias));
        }

        $log->write("\n$ {$command}\n");

        $isSudo = str_starts_with(trim($command), 'sudo ');
        $ssh = $isSudo ? $this->site->server->ssh() : $this->site->server->ssh($this->site->user);
        $ssh->setLog($log);
        $ssh->variables($variables);

        $ssh->exec(
            "{$aliasPrefix}cd {$sitePath} && {$command}",
            'install-commands',
            $this->site->id
        );

        if ($isSudo) {
            try {
                $this->site->server->ssh()->exec("sudo chown -R {$this->site->user}:{$this->site->user} {$sitePath}");
            } catch (Throwable) {
            }
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
