<?php

namespace App\Jobs\Site;

use App\Actions\Site\BroadcastSiteUpdate;
use App\Actions\Site\CountTodayLogErrors;
use App\Models\Site;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;
use Throwable;

class CountTodayLogErrorsJob implements ShouldQueue, ShouldBeUnique
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
        return 600;
    }

    public function handle(): void
    {
        $this->run("site-log-errors-{$this->site->id}", function (): void {
            $previous = Cache::get("site:{$this->site->id}:log-errors-today");

            if (app(CountTodayLogErrors::class)->refresh($this->site) !== $previous) {
                app(BroadcastSiteUpdate::class)->broadcast($this->site);
            }
        });
    }

    public function failed(Throwable $e): void
    {
        app(CountTodayLogErrors::class)->forgetPending($this->site);
    }
}
