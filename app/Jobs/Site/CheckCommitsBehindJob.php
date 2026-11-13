<?php

namespace App\Jobs\Site;

use App\Actions\Site\GetCommitsBehind;
use App\Models\Site;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class CheckCommitsBehindJob implements ShouldQueue, ShouldBeUnique
{
    use Queueable;
    use UniqueQueue;

    public int $timeout = 60;

    public function __construct(protected Site $site) {}

    public function uniqueId(): string
    {
        return (string) $this->site->id;
    }

    public function uniqueFor(): int
    {
        return 300;
    }

    public function handle(): void
    {
        $this->run("site-commits-behind-{$this->site->id}", function (): void {
            $commitId = $this->site->deployedCommitId();

            if ($commitId) {
                app(GetCommitsBehind::class)->refresh($this->site, $commitId);
            }
        });
    }
}
