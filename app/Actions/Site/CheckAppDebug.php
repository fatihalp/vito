<?php

namespace App\Actions\Site;

use App\Helpers\EnvParser;
use App\Jobs\Site\CheckAppDebugJob;
use App\Models\Site;
use App\SiteTypes\Laravel;
use Illuminate\Support\Facades\Cache;

class CheckAppDebug
{
    public function applies(Site $site): bool
    {
        return $site->server->stage === 'prod' && $site->typeOrNull()?->language() === 'php';
    }

    public function disabled(Site $site): ?bool
    {
        $cached = Cache::get($this->key($site));

        if ($cached === null && Cache::add($this->key($site).':pending', true, 300)) {
            dispatch(new CheckAppDebugJob($site));
        }

        return $cached;
    }

    public function refresh(Site $site): bool
    {
        $variables = collect(EnvParser::parse($site->server->os()->readFile($site->resolveEnvPath(), 8)));
        $variable = $variables->firstWhere('key', 'APP_DEBUG');
        $disabled = ($variable['value'] ?? null) === 'false';

        Cache::put($this->key($site), $disabled, now()->addDay());
        Cache::put("site:{$site->id}:app-key-missing", trim($variables->firstWhere('key', 'APP_KEY')['value'] ?? '') === '', now()->addDay());
        Cache::forget($this->key($site).':pending');

        return $disabled;
    }

    public function missingAppKey(Site $site): ?bool
    {
        if ($site->type !== Laravel::id() || $site->resolveEnvPath() !== $site->path.'/.env') {
            return null;
        }

        $cached = Cache::get("site:{$site->id}:app-key-missing");

        if ($cached === null && Cache::add($this->key($site).':pending', true, 300)) {
            dispatch(new CheckAppDebugJob($site));
        }

        return $cached;
    }

    public function forget(Site $site): void
    {
        Cache::forget($this->key($site));
        Cache::forget("site:{$site->id}:app-key-missing");
        Cache::forget($this->key($site).':pending');
    }

    private function key(Site $site): string
    {
        return "site:{$site->id}:app-debug-disabled";
    }
}
