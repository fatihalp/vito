<?php

namespace App\SiteTypes;

use App\Exceptions\FailedToDeployGitKey;
use App\Exceptions\SSHError;
use App\Models\Site;

class Laravel extends PHPSite
{
    public static function id(): string
    {
        return 'laravel';
    }

    public static function make(): self
    {
        return new self(new Site(['type' => self::id()]));
    }

    
    public function install(): void
    {
        parent::install();

        $envPath = $this->site->type_data['env_path'] ?? $this->site->path.'/.env';
        $examplePath = $this->site->path.'/.env.example';

        $this->step('ensuring-env', 85, function () use ($envPath, $examplePath) {
            $this->site->server->ssh($this->site->user)->exec(
                view('ssh.laravel.ensure-env', [
                    'envPath' => $envPath,
                    'examplePath' => $examplePath,
                ]),
                'ensure-env',
                $this->site->id,
            );
        });
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
            ['key' => 'installing-composer-dependencies', 'label' => 'Installing Composer Dependencies', 'percentage' => 75],
            ['key' => 'ensuring-env', 'label' => 'Ensuring Environment Configuration', 'percentage' => 85],
            ['key' => 'finishing', 'label' => 'Finalizing & Verifying', 'percentage' => 90],
        ];
    }

    public function baseCommands(): array
    {
        return array_merge(parent::baseCommands(), [
            [
                'name' => 'cache:clear',
                'command' => 'php artisan cache:clear',
            ],
            [
                'name' => 'down',
                'command' => 'php artisan down --retry=5 --refresh=6 --quiet',
            ],
            [
                'name' => 'up',
                'command' => 'php artisan up',
            ],
        ]);
    }
}
