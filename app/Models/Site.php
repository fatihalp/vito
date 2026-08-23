<?php

namespace App\Models;

use App\Traits\HasFeatures;

use App\Actions\SiteResource\CleanupSiteResources;
use App\Enums\DeploymentStatus;
use App\Enums\HostedDomainStatus;
use App\Enums\HostedDomainType;
use App\Enums\RedirectStatus;
use App\Enums\SiteStatus;
use App\Enums\SslStatus;
use App\Enums\WorkerStatus;
use App\Exceptions\SourceControlIsNotConnected;
use App\Exceptions\SSHError;
use App\Helpers\SiteShellEnvironment;
use App\Helpers\SSH;
use App\Jobs\SSL\DeleteSslJob;
use App\Services\Webserver\Webserver;
use App\SiteTypes\AbstractProxiedSiteType;
use App\SiteTypes\AbstractSiteType;
use App\SiteTypes\BunSite;
use App\SiteTypes\NodeSite;
use App\SiteTypes\SiteType;
use App\Tooling\ToolingRegistry;
use App\Traits\HasProjectThroughServer;
use Database\Factories\SiteFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class Site extends AbstractModel
{
    use HasFeatures;
    
    use HasFactory;

    use HasProjectThroughServer;

    protected $fillable = [
        'server_id',
        'isolated_user_id',
        'type',
        'type_data',
        'env_variables',
        'domain',
        'aliases',
        'web_directory',
        'path',
        'php_version',
        'source_control',
        'source_control_id',
        'repository',
        'ssh_key',
        'branch',
        'status',
        'port',
        'progress',
        'user',
        'force_ssl',
        'ssl_enabled',
        'vhost_template',
        'vhost_generation_enabled',
        'verification_key',
    ];

    protected $with = ['isolatedUser'];

    protected $casts = [
        'server_id' => 'integer',
        'isolated_user_id' => 'integer',
        'type_data' => 'json',
        'env_variables' => 'encrypted:array',
        'worker_environment' => 'encrypted:array',
        'port' => 'integer',
        'progress' => 'integer',
        'aliases' => 'array',
        'source_control_id' => 'integer',
        'force_ssl' => 'boolean',
        'ssl_enabled' => 'boolean',
        'vhost_generation_enabled' => 'boolean',
        'status' => SiteStatus::class,
    ];

    public static function boot(): void
    {
        parent::boot();

        static::deleting(function (Site $site): void {
            app(CleanupSiteResources::class)->cleanup($site);
            $site->workers()->each(function ($worker): void {
                
                $worker->delete();
            });
            $site->ssls()->each(function (Ssl $ssl) use ($site): void {
                dispatch(new DeleteSslJob($site->server, $ssl))->onQueue('ssh');
            });
            $site->deployments()->delete();
            $site->deploymentScript()->delete();
            $site->gitHook?->destroyHook();
        });

        static::created(function (Site $site): void {
            $site->createDefaultDeploymentScript();
        });
    }

    public function isReady(): bool
    {
        return $this->status === SiteStatus::READY;
    }

    public function ssh(): SSH
    {
        return $this->server->ssh($this->user)->variables(
            SiteShellEnvironment::collect($this)
        );
    }

    public function isInstalling(): bool
    {
        return in_array($this->status, [SiteStatus::INSTALLING, SiteStatus::INSTALLATION_FAILED]);
    }

    public function isInstallationFailed(): bool
    {
        return $this->status === SiteStatus::INSTALLATION_FAILED;
    }

    
    public function getWarnings(): array
    {
        return app(\App\Actions\Site\GetSiteWarnings::class)->get($this);
    }

    public function bootstrapWorkerId(): ?int
    {
        $storedId = $this->type_data['bootstrap_worker_id'] ?? null;
        if (is_int($storedId)) {
            return $storedId;
        }

        return (is_string($storedId) && ctype_digit($storedId)) ? (int) $storedId : null;
    }

    
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    
    public function isolatedUser(): BelongsTo
    {
        return $this->belongsTo(IsolatedUser::class);
    }

    public function getUserAttribute(): ?string
    {
        return $this->isolatedUser?->username;
    }

    public function getSshKeyAttribute(): ?string
    {
        return $this->isolatedUser?->ssh_key;
    }

    
    public function logs(): HasMany
    {
        return $this->hasMany(ServerLog::class);
    }

    
    public function deployments(): HasMany
    {
        return $this->hasMany(Deployment::class);
    }

    
    public function commands(): HasMany
    {
        return $this->hasMany(Command::class);
    }

    
    public function gitHook(): HasOne
    {
        return $this->hasOne(GitHook::class);
    }

    
    public function deploymentScripts(): HasMany
    {
        return $this->hasMany(DeploymentScript::class);
    }

    
    public function deploymentScript(): HasOne
    {
        return $this->hasOne(DeploymentScript::class, 'site_id')->where('name', 'default');
    }

    
    public function buildScript(): HasOne
    {
        return $this->hasOne(DeploymentScript::class, 'site_id')->where('name', 'build');
    }

    
    public function preFlightScript(): HasOne
    {
        return $this->hasOne(DeploymentScript::class, 'site_id')->where('name', 'pre-flight');
    }

    public function ensureDeploymentScriptsExist(): void
    {
        $created = false;

        if ($this->modernDeploymentEnabled()) {
            if (! $this->buildScript) {
                $this->deploymentScripts()->create([
                    'name' => 'build',
                    'content' => $this->resolveDefaultScript(fn (SiteType $type) => $type->defaultBuildScript()),
                ]);
                $created = true;
            }
            if (! $this->preFlightScript) {
                $this->deploymentScripts()->create([
                    'name' => 'pre-flight',
                    'content' => $this->resolveDefaultScript(fn (SiteType $type) => $type->defaultPreFlightScript()),
                    'configs' => [
                        'restart_workers' => $this->deploymentScript?->shouldRestartWorkers() ?? false,
                    ],
                ]);
                $created = true;
            }
        }

        if (! $this->deploymentScript) {
            $this->deploymentScripts()->create([
                'name' => 'default',
                'content' => '',
            ]);
            $created = true;
        }

        if ($created) {
            $this->refresh();
        }
    }

    public function modernDeploymentEnabled(): bool
    {
        return (bool) ($this->type_data['modern_deployment'] ?? false);
    }

    
    public function deploymentScriptFor(bool $modern): ?DeploymentScript
    {
        return $modern ? $this->preFlightScript : $this->deploymentScript;
    }

    public function activeDeploymentScript(): ?DeploymentScript
    {
        return $this->deploymentScriptFor($this->modernDeploymentEnabled());
    }

    public function statsEnabled(): bool
    {
        return ! (bool) ($this->type_data['stats_disabled'] ?? false);
    }

    
    public function workers(): HasMany
    {
        return $this->hasMany(Worker::class);
    }

    
    public function resources(): HasMany
    {
        return $this->hasMany(SiteResource::class);
    }

    
    public function cronJobs(): HasMany
    {
        return $this->hasMany(CronJob::class);
    }

    
    public function ssls(): HasMany
    {
        return $this->hasMany(Ssl::class);
    }

    
    public function hostedDomains(): HasMany
    {
        return $this->hasMany(HostedDomain::class);
    }

    
    public function primaryHostedDomain(): HasOne
    {
        return $this->hasOne(HostedDomain::class)->where('type', HostedDomainType::PRIMARY);
    }

    
    public function sourceControl(): BelongsTo
    {
        return $this->belongsTo(SourceControl::class)->withTrashed();
    }

    public function getFullRepositoryUrl(): ?string
    {
        return $this->sourceControl?->provider()?->fullRepoUrl($this->repository, $this->getSshKeyName());
    }

    public function getAliasesString(): string
    {
        if (count($this->aliases) > 0) {
            return implode(' ', $this->aliases);
        }

        return '';
    }

    public function type(): SiteType
    {
        $handlerClass = config('site.types.'.$this->type.'.handler');
        if (! class_exists($handlerClass)) {
            throw new RuntimeException("Site type handler class {$handlerClass} does not exist.");
        }

        $handler = new $handlerClass($this);

        return $handler;
    }

    
    public function typeOrNull(): ?SiteType
    {
        try {
            return $this->type();
        } catch (RuntimeException) {
            return null;
        }
    }

    public function php(): ?Service
    {
        if ($this->php_version) {
            return $this->server->php($this->php_version);
        }

        return null;
    }

    public function supportsPhpSettings(): bool
    {
        if (! $this->php_version) {
            return false;
        }

        $isPhp = (bool) ($this->typeOrNull()?->vhostData()['is_php'] ?? false);
        $isOctane = (bool) data_get($this->type_data, 'octane', false);

        return $isPhp
            && ! $isOctane
            && $this->vhost_generation_enabled
            && $this->vhost_template === null;
    }

    
    public function phpSettings(): array
    {
        return [
            'max_upload_size' => $this->phpSetting('max_upload_size'),
            'max_execution_time' => $this->phpSetting('max_execution_time'),
            'memory_limit' => $this->phpSetting('memory_limit'),
            'max_input_vars' => $this->phpSetting('max_input_vars'),
        ];
    }

    private function phpSetting(string $key): ?int
    {
        $value = data_get($this->type_data, "php.{$key}");

        return is_numeric($value) ? (int) $value : null;
    }

    public function getUrl(): string
    {
        if ($this->ssl_enabled) {
            return 'https://'.$this->domain;
        }

        return 'http://'.$this->domain;
    }

    public function getWebDirectoryPath(): string
    {
        if ($this->web_directory) {
            return $this->path.'/'.$this->web_directory;
        }

        return $this->path;
    }

    
    public function enableAutoDeployment(): void
    {
        if ($this->gitHook) {
            return;
        }

        if (! $this->sourceControl?->getRepo($this->repository)) {
            throw new SourceControlIsNotConnected($this->source_control);
        }

        $gitHook = new GitHook([
            'site_id' => $this->id,
            'source_control_id' => $this->source_control_id,
            'secret' => Str::uuid()->toString(),
            'actions' => ['deploy'],
            'events' => ['push'],
        ]);
        $gitHook->save();
        $gitHook->deployHook();
    }

    
    public function disableAutoDeployment(): void
    {
        if (! $this->sourceControl?->getRepo($this->repository)) {
            throw new SourceControlIsNotConnected($this->source_control);
        }

        $this->gitHook?->destroyHook();
    }

    public function isAutoDeployment(): bool
    {
        return (bool) $this->gitHook;
    }

    public function getSshKeyName(): string
    {
        return $this->isolated_user_id
            ? 'iuser_'.$this->isolated_user_id
            : 'site_'.$this->id;
    }

    
    public function resolveEnvPath(?string $path = null): string
    {
        $stored = data_get($this->type_data, 'env_path');

        if ($path === null) {
            return is_string($stored) ? $stored : $this->path.'/.env';
        }

        if ($stored !== null && $path === $stored) {
            return $path;
        }

        if (
            preg_match('/^[a-zA-Z0-9\/_.\-]+\z/', $path) !== 1
            || str_contains($path, '..')
            || ! str_starts_with($path, $this->path.'/')
        ) {
            throw ValidationException::withMessages([
                'path' => __('The path must be within the site directory.'),
            ]);
        }

        return $path;
    }

    
    public function getEnv(?string $path = null): string
    {
        try {
            return $this->server->os()->readFile($this->resolveEnvPath($path));
        } catch (SSHError) {
            return '';
        }
    }

    
    public function environmentVariables(?Deployment $deployment = null): array
    {
        $variables = [
            'SITE_PATH' => $this->path,
            'DOMAIN' => $this->domain,
            'BRANCH' => $this->branch ?? '',
            'REPOSITORY' => $this->repository ?? '',
            'COMMIT_ID' => $deployment->commit_id ?? '',
            'PHP_VERSION' => $this->php_version,
            'PHP_PATH' => '/usr/bin/php'.$this->php_version,
        ];

        if ($this->sourceControl?->isGithubApp()) {
            
            $provider = $this->sourceControl->provider();
            $variables['GIT_HTTP_TOKEN'] = $provider->installationAccessToken();
        }

        return $variables;
    }

    
    public function environmentAliases(): array
    {
        return [
            'php' => '/usr/bin/php'.$this->php_version,
        ];
    }

    public function isIsolated(): bool
    {
        return $this->isolated_user_id !== null;
    }

    public function userSharedWithSiblings(): bool
    {
        return $this->siblingsSharingUser()->exists();
    }

    
    public function siblingsSharingUser(bool $includeSelf = false): Builder
    {
        if (! $this->isolated_user_id) {
            return Site::query()->whereRaw('1 = 0');
        }

        $query = Site::query()->where('isolated_user_id', $this->isolated_user_id);

        if (! $includeSelf) {
            $query->where('id', '!=', $this->id);
        }

        return $query;
    }

    
    public function availableToolingCommands(): array
    {
        $commands = [];

        if ($this->php_version) {
            $commands[] = 'php';
        }

        foreach (ToolingRegistry::all() as $id => $tool) {
            if ($this->isolatedUser?->toolingVersion($id) !== null) {
                $commands = array_merge($commands, $tool::commands());
            }
        }

        return array_values(array_unique($commands));
    }

    
    public function requiredToolingMap(): array
    {
        $required = [];

        foreach ($this->siblingsSharingUser(includeSelf: true)->get() as $site) {
            $type = $site->type();
            if (! $type instanceof AbstractSiteType) {
                continue;
            }

            $typeId = $type::id();
            $label = config('site.types.'.$typeId.'.label') ?? $typeId;

            foreach ($type::requiredTooling() as $toolId) {
                $required[$toolId] = $label;
            }
        }

        return $required;
    }

    public function fpmPoolSharedWithSiblings(?string $phpVersion = null): bool
    {
        if (! $this->isolated_user_id) {
            return false;
        }

        return Site::query()
            ->where('isolated_user_id', $this->isolated_user_id)
            ->where('php_version', $phpVersion ?? $this->php_version)
            ->where('id', '!=', $this->id)
            ->exists();
    }

    public function webserver(): Webserver
    {
        
        $webserver = $this->server->webserver();

        
        $handler = $webserver->handler();

        return $handler;
    }

    
    public function loadBalancerServers(): HasMany
    {
        return $this->hasMany(LoadBalancerServer::class, 'load_balancer_id');
    }

    
    public function getSshUsers(): array
    {
        $users = ['root'];

        if ($sshUser = $this->server->getSshUser()) {
            $users[] = $sshUser;
        }

        if ($this->isIsolated() && filled($this->user)) {
            $users[] = $this->user;
        }

        return array_values(array_unique(array_filter($users, fn ($u) => is_string($u) && $u !== '')));
    }

    
    public function redirects(): HasMany
    {
        return $this->hasMany(Redirect::class);
    }

    
    public function activeRedirects(): HasMany
    {
        return $this->redirects()->whereIn('status', [RedirectStatus::CREATING, RedirectStatus::READY]);
    }
    public function featuresConfig(): array
    {
        return config('site.types.'.$this->type.'.features', []);
    }

    public function createDefaultDeploymentScript(): void
    {
        if ($this->deploymentScript) {
            return;
        }

        $deploymentScript = new DeploymentScript([
            'site_id' => $this->id,
            'name' => 'default',
            'content' => $this->resolveDefaultScript(fn (SiteType $type) => $type->defaultDeploymentScript()),
            'configs' => [
                'restart_workers' => true,
            ],
        ]);
        $deploymentScript->save();
        $this->refresh();
    }

    
    private function resolveDefaultScript(callable $resolver): string
    {
        try {
            return $resolver($this->type());
        } catch (\Throwable $e) {
            Log::error('Failed to render default deployment script for site '.$this->id, [
                'type' => $this->type,
                'error' => $e->getMessage(),
            ]);

            return '';
        }
    }

    public function basePath(): string
    {
        return preg_replace('#/current$#', '', $this->path);
    }

    public function htpasswdPath(): string
    {
        return '/etc/nginx/auth/site-'.$this->id.'.htpasswd';
    }

    public function getDeployKeyName(): string
    {
        return $this->domain.'-key-'.$this->id;
    }
}
