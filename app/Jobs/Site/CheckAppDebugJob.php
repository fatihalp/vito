<?php

namespace App\Jobs\Site;

use App\Actions\Site\BroadcastSiteUpdate;
use App\Actions\Site\CheckAppDebug;
use App\Models\Site;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

class CheckAppDebugJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public function __construct(protected Site $site)
    {
        $this->onQueue('ssh');
    }

    public function handle(): void
    {
        $this->run("site-app-debug-{$this->site->id}", function (): void {
            $previous = Cache::get("site:{$this->site->id}:app-debug-disabled");
            $current = app(CheckAppDebug::class)->refresh($this->site);

            if ($previous !== $current) {
                app(BroadcastSiteUpdate::class)->broadcast($this->site);
            }
        });
    }

    public function failed(Exception $e): void
    {
        Cache::forget("site:{$this->site->id}:app-debug-disabled:pending");
    }
}
