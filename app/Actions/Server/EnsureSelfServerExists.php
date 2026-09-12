<?php

namespace App\Actions\Server;

use App\Enums\OperatingSystem;
use App\Enums\ServerRole;
use App\Enums\ServerStatus;
use App\Enums\ServiceStatus;
use App\Models\Project;
use App\Models\Server;
use App\Models\Service;
use App\Models\User;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

class EnsureSelfServerExists
{
    public function ensure(?User $user = null): ?Server
    {
        $existing = Server::query()->where('is_self', true)->first();

        if ($existing) {
            $this->ensureKeys($existing);
            $this->ensureAuthorizedKey();

            if (! $existing->project_id || ! Project::query()->whereKey($existing->project_id)->exists()) {
                $project = $user?->currentProject ?? $user?->projects()->first() ?? Project::query()->first();
                if ($project) {
                    $existing->update(['project_id' => $project->id]);
                }
            }

            if ($existing->name !== 'Vito sunucusu') {
                $existing->update(['name' => 'Vito sunucusu']);
            }

            if ($existing->services()->count() === 0) {
                $this->createDefaultServices($existing);
            }

            return $existing;
        }

        $project = $user?->currentProject ?? $user?->projects()->first() ?? Project::query()->first();

        if (! $project) {
            return null;
        }

        $creator = $user ?? $project->users()->first() ?? User::query()->first();
        $ip = $this->detectIp();
        $os = $this->detectOs();

        $server = Server::query()->create([
            'project_id' => $project->id,
            'user_id' => $creator?->id,
            'name' => 'Vito sunucusu',
            'role' => ServerRole::APP,
            'stage' => 'prod',
            'ssh_user' => config('core.ssh_user', 'vito'),
            'ip' => $ip,
            'local_ip' => '127.0.0.1',
            'port' => 22,
            'os' => $os,
            'provider' => 'custom',
            'status' => ServerStatus::READY,
            'progress' => 100,
            'progress_step' => null,
            'is_self' => true,
            'auto_update' => false,
            'updates' => 0,
            'kernel_updates' => 0,
            'public_key' => get_public_key_content(),
            'authentication' => [
                'user' => config('core.ssh_user', 'vito'),
            ],
        ]);

        $this->ensureKeys($server);
        $this->ensureAuthorizedKey();
        $this->createDefaultServices($server);

        return $server;
    }

    private function detectIp(): string
    {
        $host = parse_url((string) config('app.url'), PHP_URL_HOST);

        if ($host && filter_var($host, FILTER_VALIDATE_IP)) {
            return $host;
        }

        if ($host) {
            $resolved = gethostbyname($host);
            if (filter_var($resolved, FILTER_VALIDATE_IP)) {
                return $resolved;
            }
        }

        if (! empty($_SERVER['SERVER_ADDR']) && filter_var($_SERVER['SERVER_ADDR'], FILTER_VALIDATE_IP)) {
            return $_SERVER['SERVER_ADDR'];
        }

        return '127.0.0.1';
    }

    private function detectOs(): OperatingSystem
    {
        if (File::exists('/etc/os-release')) {
            $osRelease = (string) File::get('/etc/os-release');
            if (str_contains($osRelease, '26.04')) {
                return OperatingSystem::UBUNTU26;
            }
            if (str_contains($osRelease, '22.04')) {
                return OperatingSystem::UBUNTU22;
            }
            if (str_contains($osRelease, '20.04')) {
                return OperatingSystem::UBUNTU20;
            }
            if (str_contains($osRelease, '18.04')) {
                return OperatingSystem::UBUNTU18;
            }
        }

        return OperatingSystem::UBUNTU24;
    }

    private function ensureKeys(Server $server): void
    {
        $storageDisk = Storage::disk(config('core.key_pairs_disk'));
        $privatePath = $storageDisk->path((string) $server->id);
        $publicPath = $storageDisk->path($server->id.'.pub');

        File::ensureDirectoryExists($storageDisk->path(''));

        $masterPrivate = storage_path(config('core.ssh_private_key_name'));
        $masterPublic = storage_path(config('core.ssh_public_key_name'));

        if (! File::exists($privatePath) && File::exists($masterPrivate)) {
            File::copy($masterPrivate, $privatePath);
        }

        if (! File::exists($publicPath) && File::exists($masterPublic)) {
            File::copy($masterPublic, $publicPath);
        }
    }

    private function ensureAuthorizedKey(): void
    {
        $pubKeyPath = storage_path(config('core.ssh_public_key_name'));
        if (! File::exists($pubKeyPath)) {
            return;
        }

        $pubKey = trim((string) File::get($pubKeyPath));
        if ($pubKey === '') {
            return;
        }

        $home = getenv('HOME') ?: (isset($_SERVER['HOME']) ? $_SERVER['HOME'] : '/home/vito');
        $sshDir = $home.'/.ssh';
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
        $phpVersion = (string) (PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION);

        $services = [
            [
                'server_id' => $server->id,
                'type' => 'webserver',
                'name' => 'nginx',
                'version' => 'latest',
                'installed_version' => null,
                'unit' => 'nginx',
                'status' => ServiceStatus::READY,
                'is_default' => true,
            ],
            [
                'server_id' => $server->id,
                'type' => 'php',
                'name' => 'php',
                'version' => $phpVersion,
                'installed_version' => PHP_VERSION,
                'unit' => 'php'.$phpVersion.'-fpm',
                'status' => ServiceStatus::READY,
                'is_default' => true,
            ],
            [
                'server_id' => $server->id,
                'type' => 'memory_database',
                'name' => 'redis',
                'version' => 'latest',
                'installed_version' => null,
                'unit' => 'redis-server',
                'status' => ServiceStatus::READY,
                'is_default' => true,
            ],
            [
                'server_id' => $server->id,
                'type' => 'process_manager',
                'name' => 'supervisor',
                'version' => 'latest',
                'installed_version' => null,
                'unit' => 'supervisor',
                'status' => ServiceStatus::READY,
                'is_default' => true,
            ],
            [
                'server_id' => $server->id,
                'type' => 'firewall',
                'name' => 'ufw',
                'version' => 'latest',
                'installed_version' => null,
                'unit' => 'ufw',
                'status' => ServiceStatus::READY,
                'is_default' => true,
            ],
            [
                'server_id' => $server->id,
                'type' => 'monitoring',
                'name' => 'remote-monitor',
                'version' => 'latest',
                'installed_version' => null,
                'unit' => 'remote-monitor',
                'status' => ServiceStatus::READY,
                'is_default' => true,
            ],
        ];

        foreach ($services as $serviceData) {
            Service::query()->create($serviceData);
        }
    }
}
