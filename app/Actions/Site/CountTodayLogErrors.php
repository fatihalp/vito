<?php

namespace App\Actions\Site;

use App\Jobs\Site\CountTodayLogErrorsJob;
use App\Models\Site;
use Illuminate\Support\Facades\Cache;

class CountTodayLogErrors
{
    public function count(Site $site): ?int
    {
        if (! $site->php_version || ! $site->server?->isReady()) {
            return null;
        }

        $cached = Cache::get($this->key($site));

        if ($cached === null && Cache::add($this->key($site).':pending', true, 300)) {
            dispatch(new CountTodayLogErrorsJob($site));
        }

        return $cached;
    }

    public function refresh(Site $site): int
    {
        $count = (int) trim($site->server->ssh()->exec(view('ssh.os.count-today-log-errors', [
            'path' => rtrim($site->path, '/').'/storage/logs/laravel.log',
        ])));

        Cache::put($this->key($site), $count, now()->addMinutes(10));
        Cache::forget($this->key($site).':pending');

        return $count;
    }

    public function forgetPending(Site $site): void
    {
        Cache::forget($this->key($site).':pending');
    }

    private function key(Site $site): string
    {
        return "site:{$site->id}:log-errors-today";
    }
}
