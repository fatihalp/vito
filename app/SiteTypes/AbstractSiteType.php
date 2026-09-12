<?php

namespace App\SiteTypes;

use App\DTOs\SocketEventDTO;
use App\Events\SocketEvent;
use App\Exceptions\FailedToDeployGitKey;
use App\Exceptions\SSHCommandError;
use App\Exceptions\SSHError;
use App\Helpers\SiteShellEnvironment;
use App\Http\Resources\SiteResource;
use App\Models\Deployment;
use App\Models\Service;
use App\Models\Site;
use App\Services\PHP\PHP;
use App\SSH\OS\Git;
use App\Tooling\SiteToolingState;
use App\Tooling\ToolingRegistry;
use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use RuntimeException;

abstract class AbstractSiteType implements SiteType
{
    public function __construct(protected Site $site) {}

    abstract public static function make(): self;

    
    public static function createTimeTools(): array
    {
        return [];
    }

    
    public static function requiredTooling(): array
    {
        return [];
    }

    public static function supportsTooling(): bool
    {
        return false;
    }

    public function createRules(array $input): array
    {
        return [];
    }

    public function createFields(array $input): array
    {
        return [];
    }

    public function data(array $input): array
    {
        return [];
    }

    public function baseCommands(): array
    {
        return [];
    }

    public function vhostData(): array
    {
        return [];
    }

    
    public function deploymentEnvironment(): array
    {
        return SiteShellEnvironment::collect($this->site);
    }

    public function afterDeploy(Deployment $deployment): void
    {
        
    }

    public function assertReadyToDeploy(): void
    {
        
    }

    public function defaultDeploymentScript(): string
    {
        return $this->readDeploymentScriptFile(static::id().'.sh');
    }

    public function defaultBuildScript(): string
    {
        return $this->readDeploymentScriptFile(static::id().'-build.sh');
    }

    public function defaultPreFlightScript(): string
    {
        return $this->readDeploymentScriptFile(static::id().'-pre-flight.sh');
    }

    private function readDeploymentScriptFile(string $filename): string
    {
        $path = resource_path('deployment-scripts/'.$filename);

        return File::exists($path) ? File::get($path) : '';
    }

    
    public function supportedWebservers(): ?array
    {
        return null;
    }

    public function vhostTemplate(string $webserver): ?string
    {
        return null;
    }

    /**
     * @return array<int, array{key: string, label: string, percentage: number}>
     */
    public function installationSteps(): array
    {
        return [
            ['key' => 'isolating-user', 'label' => 'Isolating User & Environment', 'percentage' => 0],
            ['key' => 'installing-tooling', 'label' => 'Installing Runtime Tooling', 'percentage' => 15],
            ['key' => 'creating-vhost', 'label' => 'Configuring Web Server VHost', 'percentage' => 20],
            ['key' => 'deploying-ssh-key', 'label' => 'Deploying Repository SSH Key', 'percentage' => 25],
            ['key' => 'cloning-repository', 'label' => 'Cloning Source Code', 'percentage' => 40],
            ['key' => 'finishing', 'label' => 'Finalizing & Verifying', 'percentage' => 90],
        ];
    }

    protected function progress(int $percentage, ?string $step): void
    {
        $this->site->progress = $percentage;
        $this->site->progress_step = $step;
        $this->site->save();

        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $this->site->server->project_id,
            type: 'site.updated',
            data: new SiteResource($this->site),
        ));
    }

    public function isStepCompleted(string $step): bool
    {
        $completed = $this->site->type_data['completed_steps'] ?? [];

        return is_array($completed) && in_array($step, $completed, true);
    }

    public function completeStep(string $step): void
    {
        $completed = $this->site->type_data['completed_steps'] ?? [];
        if (! is_array($completed)) {
            $completed = [];
        }

        if (! in_array($step, $completed, true)) {
            $completed[] = $step;
            $this->site->jsonUpdate('type_data', 'completed_steps', array_values($completed));
        }
    }

    protected function step(string $step, int $percentage, callable $callback): void
    {
        if ($this->isStepCompleted($step)) {
            return;
        }

        $this->progress($percentage, $step);
        $callback();
        $this->completeStep($step);
    }

    
    protected function deployKey(): void
    {
        if (! $this->site->sourceControl) {
            return;
        }

        if ($this->site->sourceControl->isGithubApp()) {
            return;
        }

        $os = $this->site->server->os();

        if (! $this->site->ssh_key) {
            $keyName = $this->site->getSshKeyName();
            $os->generateSSHKey($keyName, $this->site);
            $publicKey = $os->readSSHKey($keyName, $this->site);

            if (str_starts_with($keyName, 'iuser_') && $this->site->isolatedUser) {
                $this->site->isolatedUser->ssh_key = $publicKey;
                $this->site->isolatedUser->save();
                $this->site->setRelation('isolatedUser', $this->site->isolatedUser->fresh());
            } else {
                $this->site->ssh_key = $publicKey;
                $this->site->save();
            }
        }

        if (empty($this->site->type_data['deploy_key_id'])) {
            $keyId = $this->site->sourceControl?->provider()?->deployKey(
                $this->site->getDeployKeyName(),
                $this->site->repository,
                $this->site->ssh_key
            );
            $this->site->jsonUpdate('type_data', 'deploy_key_id', $keyId);
        }
    }

    
    protected function isolate(): void
    {
        if (! $this->site->isIsolated()) {
            return;
        }

        $lock = $this->site->isolatedUser->lock();

        try {
            $lock->block(30);
        } catch (LockTimeoutException) {
            throw new RuntimeException("Could not acquire isolated-user lock for '{$this->site->user}' on server {$this->site->server_id} within 30s.");
        }

        try {
            $this->site->server->os()->createIsolatedUser(
                $this->site->user,
                Str::random(15),
                $this->site->id
            );

            if ($this->site->php_version) {
                $service = $this->site->php();
                if (! $service instanceof Service) {
                    throw new RuntimeException('PHP service not found');
                }
                if (! $this->site->fpmPoolSharedWithSiblings() && ! $this->fpmPoolExists($this->site->user, $this->site->php_version)) {
                    
                    $php = $service->handler();
                    $php->createFpmPool(
                        $this->site->user,
                        $this->site->php_version
                    );
                }
            }
        } finally {
            $lock->release();
        }
    }

    public function attachSourceControl(): void
    {
        $this->deployKey();
        $this->cloneRepository();
    }

    protected function cloneRepository(): void
    {
        if (! $this->site->repository) {
            return;
        }

        if ($this->repositoryAlreadyCloned()) {
            return;
        }
        app(Git::class)->clone($this->site);
    }

    
    protected function repositoryAlreadyCloned(): bool
    {
        try {
            $this->site->server->ssh($this->site->user)->exec(view('ssh.site.check-repository-cloned', [
                'path' => $this->site->path,
            ]));

            return true;
        } catch (SSHCommandError) {
            return false;
        }
    }

    
    protected function fpmPoolExists(string $user, string $version): bool
    {
        try {
            $this->site->server->ssh()->exec(view('ssh.site.check-fpm-pool-exists', [
                'user' => $user,
                'version' => $version,
            ]));

            return true;
        } catch (SSHCommandError) {
            return false;
        }
    }

    
    protected function setupRequestedTooling(): void
    {
        $iuser = $this->site->isolatedUser;

        foreach (static::createTimeTools() as $toolId) {
            $tool = ToolingRegistry::find($toolId);
            if (! $tool) {
                continue;
            }

            $key = $tool::typeDataKey();
            $version = $this->site->type_data[$key] ?? 'none';
            if ($version === 'none' || $version === '') {
                continue;
            }

            $existing = $iuser?->toolingVersion($toolId);

            if ($existing === $version) {
                continue;
            }

            $tool->install($this->site, $version);

            SiteToolingState::completeInstall($this->site, $toolId, $version);

            $typeData = $this->site->type_data ?? [];
            unset($typeData[$key]);
            $this->site->type_data = $typeData;
            $this->site->save();
        }
    }
}
