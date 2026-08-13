<?php

namespace App\Actions\Site;

use App\Models\CronJob;
use App\Models\Site;
use App\Models\Worker;
use Illuminate\Support\Collection;

class GetSiteOverview
{
    /**
     * @return array{
     *     workers: Collection<int, Worker>,
     *     workers_count: int,
     *     cron_jobs: Collection<int, CronJob>,
     *     cron_jobs_count: int
     * }
     */
    public function get(Site $site): array
    {
        return [
            'workers' => $site->workers()->with('site:id,server_id,type_data')->latest()->limit(3)->get(),
            'workers_count' => $site->workers()->count(),
            'cron_jobs' => $site->cronJobs()->latest()->limit(3)->get(),
            'cron_jobs_count' => $site->cronJobs()->count(),
        ];
    }
}
