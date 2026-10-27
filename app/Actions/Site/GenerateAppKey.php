<?php

namespace App\Actions\Site;

use App\Enums\EnvVersionSource;
use App\Helpers\EnvParser;
use App\Models\Site;
use App\Models\User;
use App\SiteTypes\Laravel;
use Illuminate\Validation\ValidationException;

class GenerateAppKey
{
    public function __construct(private RecordEnvVersion $recordEnvVersion) {}

    public function generate(Site $site, User $user, bool $onlyIfMissing = false): void
    {
        $path = $site->resolveEnvPath();

        if ($site->type !== Laravel::id() || $path !== $site->path.'/.env') {
            throw ValidationException::withMessages([
                'env' => __('The application key can only be generated for the default .env file of Laravel sites.'),
            ]);
        }

        $previous = $site->server->os()->readFile($path);

        if ($onlyIfMissing && trim(collect(EnvParser::parse($previous))->firstWhere('key', 'APP_KEY')['value'] ?? '') !== '') {
            app(CheckAppDebug::class)->forget($site);

            throw ValidationException::withMessages([
                'env' => __('The application key is already set. Refresh the page to update the warning.'),
            ]);
        }

        $site->server->os()->runScript(
            path: $site->path,
            script: 'php artisan key:generate --force && php artisan optimize:clear',
            serverLog: null,
            user: $site->user,
            variables: $site->environmentVariables(),
            aliases: $site->environmentAliases(),
        );

        $content = $site->server->os()->readFile($path);
        $this->recordEnvVersion->record($site, $path, $previous, $content, EnvVersionSource::EDITOR, $user);
        app(CheckAppDebug::class)->forget($site);
        app(BroadcastSiteUpdate::class)->broadcast($site);
    }
}
