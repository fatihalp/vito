<?php

namespace App\Actions\Site;

use App\Models\Site;
use App\Models\Worker;

class GetSiteOverview
{
    
    public function get(Site $site): array
    {
        $workers = $site->workers()
            ->latest()
            ->limit(3)
            ->get()
            ->each(fn (Worker $worker) => $worker->setRelation('site', $site));

        return [
            'workers' => $workers,
            'workers_count' => (int) ($site->workers_count ?? $site->workers()->count()),
            'cron_jobs' => $site->cronJobs()->latest()->limit(3)->get(),
            'cron_jobs_count' => (int) ($site->cron_jobs_count ?? $site->cronJobs()->count()),
        ];
    }
}
