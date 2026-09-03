<?php

namespace App\Actions\Site;

use App\Helpers\EnvParser;
use App\Jobs\Site\CheckAppDebugJob;
use App\Models\Site;
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
        $variable = collect(EnvParser::parse($site->getEnv(timeout: 8)))->firstWhere('key', 'APP_DEBUG');
        $disabled = ($variable['value'] ?? null) === 'false';

        Cache::put($this->key($site), $disabled, now()->addDay());
        Cache::forget($this->key($site).':pending');

        return $disabled;
    }

    public function forget(Site $site): void
    {
        Cache::forget($this->key($site));
        Cache::forget($this->key($site).':pending');
    }

    private function key(Site $site): string
    {
        return "site:{$site->id}:app-debug-disabled";
    }
}
