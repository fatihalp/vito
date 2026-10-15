<?php

namespace App\Actions\Site;

use App\Enums\EnvVersionSource;
use App\Models\Site;
use App\Models\User;
use App\SiteTypes\Laravel;
use Illuminate\Validation\ValidationException;

class GenerateAppKey
{
    public function __construct(private RecordEnvVersion $recordEnvVersion) {}

    public function generate(Site $site, User $user): void
    {
        $path = $site->resolveEnvPath();

        if ($site->type !== Laravel::id() || $path !== $site->path.'/.env') {
            throw ValidationException::withMessages([
                'env' => __('The application key can only be generated for the default .env file of Laravel sites.'),
            ]);
        }

        $previous = $site->server->os()->readFile($path);

        $site->server->os()->runScript(
            path: $site->path,
            script: 'php artisan key:generate --force',
            serverLog: null,
            user: $site->user,
            variables: $site->environmentVariables(),
            aliases: $site->environmentAliases(),
        );

        $content = $site->server->os()->readFile($path);
        $this->recordEnvVersion->record($site, $path, $previous, $content, EnvVersionSource::EDITOR, $user);
    }
}
