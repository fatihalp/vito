<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\View;

class GenerateCaddyfileCommand extends Command
{
    protected $signature = 'vito:generate-caddyfile';

    protected $description = 'Generate the Caddyfile for FrankenPHP from config';

    public function handle(): int
    {
        $ssl = (bool) config('core.vito_ssl');
        $domain = config('core.vito_domain', '');
        $port = config('core.vito_port', 54331);
        $wsPort = config('core.ws_port', 54332);
        $root = base_path('public');

        $content = View::make('ssh.caddyfile', [
            'ssl' => $ssl,
            'domain' => $domain,
            'port' => $port,
            'wsPort' => $wsPort,
            'root' => $root,
            'email' => '',
        ])->render();

        File::put(base_path('Caddyfile'), $content);

        $this->info('Caddyfile generated successfully.');

        return self::SUCCESS;
    }
}
