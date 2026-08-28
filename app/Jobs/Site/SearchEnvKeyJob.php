<?php

namespace App\Jobs\Site;

use App\Actions\Site\SearchEnvKey;
use App\Models\User;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

class SearchEnvKeyJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public function __construct(protected User $user, protected string $key, protected string $searchId) {}

    public function handle(): void
    {
        $this->run("env-search:{$this->searchId}", function (): void {
            $results = app(SearchEnvKey::class)->search($this->user, $this->key);

            Cache::put(
                "env-search-result:{$this->searchId}",
                ['status' => 'done', 'results' => $results],
                now()->addMinutes(10)
            );
        });
    }

    public function failed(Exception $e): void
    {
        Cache::put(
            "env-search-result:{$this->searchId}",
            ['status' => 'failed', 'error' => $e->getMessage()],
            now()->addMinutes(10)
        );
    }
}
