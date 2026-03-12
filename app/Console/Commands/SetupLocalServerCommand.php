<?php

namespace App\Console\Commands;

use App\Enums\OperatingSystem;
use App\Enums\ServerStatus;
use App\Enums\ServiceStatus;
use App\Models\Server;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class SetupLocalServerCommand extends Command
{
    protected $signature = 'server:setup-local';

    protected $description = 'Bootstrap the local server as a managed server';

    public function handle(): int
    {
        if (Server::query()->where('provider', 'local')->exists()) {
            $this->info('Local server already exists. Skipping.');

            return self::SUCCESS;
        }

        /** @var ?User $user */
        $user = User::query()->first();

        if (! $user) {
            $this->error('No admin user found. Please create a user first.');

            return self::FAILURE;
        }

        /** @var ?\App\Models\Project $project */
        $project = $user->currentProject ?? $user->allProjects()->first();

        if (! $project) {
            $this->error('No project found. Please create a project first.');

            return self::FAILURE;
        }

        $os = $this->detectOS();

        $server = new Server([
            'project_id' => $project->id,
            'user_id' => $user->id,
            'name' => 'Vito',
            'ssh_user' => 'vito',
            'ip' => '127.0.0.1',
            'port' => 22,
            'os' => $os,
            'provider' => 'local',
            'authentication' => [
                'user' => 'vito',
                'pass' => Str::random(15),
                'root_pass' => Str::random(15),
            ],
            'status' => ServerStatus::READY,
            'progress' => 100,
        ]);
        $server->save();

        $server->provider()->create();

        if (file_exists('/home/vito/.ssh/id_rsa.pub')) {
            $server->public_key = trim(file_get_contents('/home/vito/.ssh/id_rsa.pub'));
            $server->save();
        }

        $this->createServices($server);

        $this->info('Local server has been set up successfully.');

        return self::SUCCESS;
    }

    private function detectOS(): OperatingSystem
    {
        if (file_exists('/etc/os-release')) {
            $content = file_get_contents('/etc/os-release');
            if (str_contains($content, '24.04')) {
                return OperatingSystem::UBUNTU24;
            }
            if (str_contains($content, '22.04')) {
                return OperatingSystem::UBUNTU22;
            }
            if (str_contains($content, '20.04')) {
                return OperatingSystem::UBUNTU20;
            }
            if (str_contains($content, '18.04')) {
                return OperatingSystem::UBUNTU18;
            }
        }

        return OperatingSystem::UBUNTU24;
    }

    private function createServices(Server $server): void
    {
        $services = [
            [
                'type' => 'webserver',
                'name' => 'nginx',
                'version' => 'latest',
                'status' => ServiceStatus::READY,
                'is_default' => true,
            ],
            [
                'type' => 'php',
                'name' => 'php',
                'version' => '8.4',
                'status' => ServiceStatus::READY,
                'is_default' => true,
            ],
            [
                'type' => 'memory_database',
                'name' => 'redis',
                'version' => 'latest',
                'status' => ServiceStatus::READY,
                'is_default' => true,
            ],
            [
                'type' => 'process_manager',
                'name' => 'supervisor',
                'version' => 'latest',
                'status' => ServiceStatus::READY,
                'is_default' => true,
            ],
        ];

        foreach ($services as $service) {
            $server->services()->create($service);
        }
    }
}
