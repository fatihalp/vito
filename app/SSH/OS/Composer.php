<?php

namespace App\SSH\OS;

use App\Exceptions\SSHError;
use App\Helpers\SiteShellEnvironment;
use App\Models\Site;

class Composer
{
    public const DEFAULT_INSTALL_COMMAND = 'composer install --no-interaction --prefer-dist --optimize-autoloader --no-dev';

    
    public function installDependencies(Site $site, ?string $command = null): void
    {
        $site->server->ssh($site->user)
            ->variables(SiteShellEnvironment::collect($site))
            ->exec(
                view('ssh.composer.composer-install', [
                    'path' => $site->path,
                    'command' => $command !== null && trim($command) !== '' ? $command : self::DEFAULT_INSTALL_COMMAND,
                ]),
                'composer-install',
                $site->id
            );
    }
}
