<?php

namespace App\Jobs\Site;

use App\Actions\Site\BroadcastSiteUpdate;
use App\Actions\Site\DeleteSite;
use App\Enums\SiteStatus;
use App\Models\ServerLog;
use App\Models\Site;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class DeleteJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public function __construct(protected Site $site, protected SiteStatus $previousStatus) {}

    public function handle(): void
    {
        $this->run("site-{$this->site->id}", function (): void {
            app(DeleteSite::class)->teardown($this->site);
        });
    }

    public function failed(Throwable $e): void
    {
        $this->site->status = $this->previousStatus;
        $this->site->save();

        ServerLog::log($this->site->server, 'delete-site-failed', $e->getMessage(), $this->site);

        app(BroadcastSiteUpdate::class)->broadcast($this->site);
    }
}
