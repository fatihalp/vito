<?php

namespace App\Jobs\Site;

use App\Actions\Site\BroadcastSiteUpdate;
use App\Actions\Site\CheckAppDebug;
use App\Models\Site;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;

class CheckAppDebugJob implements ShouldQueue, ShouldBeUnique
{
    use Queueable;
    use UniqueQueue;

    public int $timeout = 30;

    public function __construct(protected Site $site)
    {
        $this->onQueue('ssh-checks');
    }

    public function uniqueId(): string
    {
        return (string) $this->site->id;
    }

    public function uniqueFor(): int
    {
        return 7200;
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
