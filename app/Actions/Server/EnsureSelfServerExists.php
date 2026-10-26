<?php

namespace App\Actions\Server;

use App\Enums\OperatingSystem;
use App\Enums\ServerRole;
use App\Enums\ServerStatus;
use App\Enums\ServiceStatus;
use App\Enums\SiteStatus;
use App\Enums\UserRole;
use App\Models\Command;
use App\Models\DeploymentScript;
use App\Models\Project;
use App\Models\Server;
use App\Models\Service;
use App\Models\Site;
use App\Models\User;
use App\Models\UserProject;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

class EnsureSelfServerExists
{
    public const string PROJECT_NAME = 'Vito';

    public const string SERVER_NAME = 'Vito sunucusu';

    public const string SITE_DOMAIN = 'Vito';

    private const array DEFAULT_SERVICES = [
        ['type' => 'webserver', 'name' => 'nginx', 'unit' => 'nginx'],
        ['type' => 'memory_database', 'name' => 'redis', 'unit' => 'redis-server'],
        ['type' => 'process_manager', 'name' => 'supervisor', 'unit' => 'supervisor'],
        ['type' => 'firewall', 'name' => 'ufw', 'unit' => 'ufw'],
        ['type' => 'monitoring', 'name' => 'remote-monitor', 'unit' => 'remote-monitor'],
    ];

    private const array DEFAULT_COMMANDS = [
        'vito' => 'php artisan vito',
        'optimize:clear' => 'php artisan optimize:clear',
        'migrate' => 'php artisan migrate --force',
    ];

    public function ensure(?User $user = null, bool $force = false): ?Server
    {
        $cacheKey = 'vito:self_server_ensured_v3:'.($user?->id ?? 0);

        if (! $force && ($cachedId = Cache::get($cacheKey)) && ($cached = Server::query()->find($cachedId))) {
            return $cached;
        }

        $project = $this->ensureVitoProject($user);
        if (! $project) {
            return null;
        }

        $sshUser = (string) config('core.ssh_user', 'vito');
        $server = Server::query()->firstOrNew(['is_self' => true]);

        if (! $server->exists) {
            $server->fill([
                'user_id' => $user?->id ?? User::query()->where('is_admin', true)->value('id') ?? User::query()->value('id'),
                'role' => ServerRole::APP,
                'stage' => 'prod',
                'ssh_user' => $sshUser,
                'ip' => $this->detectIp(),
                'local_ip' => '127.0.0.1',
                'port' => 22,
                'os' => $this->detectOs(),
                'provider' => 'custom',
                'status' => ServerStatus::READY,
                'progress' => 100,
                'auto_update' => false,
                'updates' => 0,
                'kernel_updates' => 0,
                'public_key' => get_public_key_content(),
                'authentication' => ['user' => $sshUser],
            ]);
        }

        $server->fill([
            'project_id' => $project->id,
            'name' => self::SERVER_NAME,
        ])->save();

        $this->ensureKeys($server);
        $this->ensureAuthorizedKey();

        if (! $server->services()->exists()) {
            $this->createDefaultServices($server);
        }

        $this->ensureSelfSite($server);

        Cache::put($cacheKey, $server->id, 3600);

        return $server;
    }

    private function ensureVitoProject(?User $user = null): ?Project
    {
        if (! $user && ! User::query()->exists()) {
            return null;
        }

        $project = Project::withTrashed()->firstOrCreate(['name' => self::PROJECT_NAME]);
        if ($project->trashed()) {
            $project->restore();
        }

        $userIds = User::query()
            ->where('is_admin', true)
            ->when($user, fn ($query) => $query->orWhere('id', $user->id))
            ->pluck('id')
            ->all() ?: array_filter([User::query()->value('id')]);

        foreach ($userIds as $userId) {
            UserProject::query()->firstOrCreate(
                ['project_id' => $project->id, 'user_id' => $userId],
                ['role' => UserRole::OWNER],
            );
        }

        return $project;
    }

    private function ensureSelfSite(Server $server): Site
    {
        $path = base_path();
        $phpVersion = PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;
        $host = parse_url((string) config('app.url'), PHP_URL_HOST);

        $site = $server->sites()
            ->where(fn ($q) => $q->where('domain', self::SITE_DOMAIN)->orWhere('path', $path))
            ->first() ?? new Site(['server_id' => $server->id]);

        $site->fill([
            'isolated_user_id' => null,
            'type' => 'laravel',
            'domain' => self::SITE_DOMAIN,
            'aliases' => $host && $host !== 'localhost' ? [$host] : [],
            'web_directory' => 'public',
            'path' => $path,
            'php_version' => $site->php_version ?: $phpVersion,
            'repository' => $site->repository ?: $this->detectGitRepository(),
            'branch' => $site->branch ?: $this->detectGitBranch(),
            'status' => SiteStatus::READY,
            'progress' => 100,
            'user' => $server->getSshUser() ?: (string) config('core.ssh_user', 'vito'),
            'force_ssl' => false,
            'ssl_enabled' => str_starts_with((string) config('app.url'), 'https://'),
            'vhost_generation_enabled' => false,
            'type_data' => array_merge($site->type_data ?? [], [
                'is_self' => true,
                'modern_deployment' => false,
                'composer' => true,
                'stats_disabled' => true,
            ]),
        ])->saveQuietly();

        $defaultScriptContent = implode("\n", [
            'git pull origin $BRANCH',
            'composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev',
            'php artisan vito',
        ]);

        $script = DeploymentScript::query()->firstOrCreate(
            ['site_id' => $site->id, 'name' => 'default'],
            ['content' => $defaultScriptContent, 'configs' => ['restart_workers' => false]],
        );

        $currentContent = trim((string) $script->content);
        if ($currentContent === '' || str_starts_with($currentContent, "git pull\nphp artisan vito")) {
            $script->update(['content' => $defaultScriptContent, 'configs' => ['restart_workers' => false]]);
        }

        if (! $site->commands()->exists()) {
            foreach (self::DEFAULT_COMMANDS as $name => $command) {
                Command::query()->create(['site_id' => $site->id, 'name' => $name, 'command' => $command]);
            }
        }

        return $site;
    }

    private function detectGitRepository(): string
    {
        $configPath = base_path('.git/config');
        if (File::exists($configPath) && preg_match('#(?:github\.com|gitlab\.com|bitbucket\.org)[:/]([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+?)(?:\.git)?\s*$#m', (string) File::get($configPath), $matches)) {
            return $matches[1];
        }

        return 'vitodeploy/vito';
    }

    private function detectGitBranch(): string
    {
        $headPath = base_path('.git/HEAD');
        if (File::exists($headPath)) {
            $head = trim((string) File::get($headPath));
            if (str_starts_with($head, 'ref: refs/heads/')) {
                return substr($head, strlen('ref: refs/heads/'));
            }
        }

        return '4.x';
    }

    private function detectIp(): string
    {
        $host = parse_url((string) config('app.url'), PHP_URL_HOST);

        if ($host && filter_var($host, FILTER_VALIDATE_IP)) {
            return $host;
        }

        if ($host && filter_var($resolved = gethostbyname($host), FILTER_VALIDATE_IP)) {
            return $resolved;
        }

        if (! empty($_SERVER['SERVER_ADDR']) && filter_var($_SERVER['SERVER_ADDR'], FILTER_VALIDATE_IP)) {
            return $_SERVER['SERVER_ADDR'];
        }

        return '127.0.0.1';
    }

    private function detectOs(): OperatingSystem
    {
        $osRelease = File::exists('/etc/os-release') ? (string) File::get('/etc/os-release') : '';

        return match (true) {
            str_contains($osRelease, '26.04') => OperatingSystem::UBUNTU26,
            str_contains($osRelease, '22.04') => OperatingSystem::UBUNTU22,
            str_contains($osRelease, '20.04') => OperatingSystem::UBUNTU20,
            str_contains($osRelease, '18.04') => OperatingSystem::UBUNTU18,
            default => OperatingSystem::UBUNTU24,
        };
    }

    private function ensureKeys(Server $server): void
    {
        $storageDisk = Storage::disk(config('core.key_pairs_disk'));
        File::ensureDirectoryExists($storageDisk->path(''));

        $pairs = [
            storage_path(config('core.ssh_private_key_name')) => $storageDisk->path((string) $server->id),
            storage_path(config('core.ssh_public_key_name')) => $storageDisk->path($server->id.'.pub'),
        ];

        foreach ($pairs as $source => $target) {
            if (! File::exists($target) && File::exists($source)) {
                File::copy($source, $target);
            }
        }
    }

    private function ensureAuthorizedKey(): void
    {
        $pubKeyPath = storage_path(config('core.ssh_public_key_name'));
        if (! File::exists($pubKeyPath) || ($pubKey = trim((string) File::get($pubKeyPath))) === '') {
            return;
        }

        $sshDir = (getenv('HOME') ?: ($_SERVER['HOME'] ?? '/home/vito')).'/.ssh';
        $authKeysPath = $sshDir.'/authorized_keys';

        if (! File::isDirectory($sshDir)) {
            File::makeDirectory($sshDir, 0700, true, true);
        }

        if (! File::exists($authKeysPath) || ! str_contains((string) File::get($authKeysPath), $pubKey)) {
            File::append($authKeysPath, PHP_EOL.$pubKey.PHP_EOL);
            @chmod($authKeysPath, 0600);
        }
    }

    private function createDefaultServices(Server $server): void
    {
        $phpVersion = PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;

        Service::query()->create([
            'server_id' => $server->id,
            'type' => 'php',
            'name' => 'php',
            'version' => $phpVersion,
            'installed_version' => PHP_VERSION,
            'unit' => 'php'.$phpVersion.'-fpm',
            'status' => ServiceStatus::READY,
            'is_default' => true,
        ]);

        foreach (self::DEFAULT_SERVICES as $service) {
            Service::query()->create([
                ...$service,
                'server_id' => $server->id,
                'version' => 'latest',
                'installed_version' => null,
                'status' => ServiceStatus::READY,
                'is_default' => true,
            ]);
        }
    }
}
