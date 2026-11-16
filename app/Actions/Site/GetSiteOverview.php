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

        $runtimeCounts = $site->runtimeProcesses()
            ->selectRaw('kind, count(*) as total')
            ->groupBy('kind')
            ->pluck('total', 'kind');

        $workersCount = (int) ($site->workers_count ?? $site->workers()->count());
        $cronJobsCount = (int) ($site->cron_jobs_count ?? $site->cronJobs()->count());

        return [
            'workers' => $workers,
            'workers_count' => $workersCount + (int) ($runtimeCounts['worker'] ?? 0),
            'cron_jobs' => $site->cronJobs()->latest()->limit(3)->get(),
            'cron_jobs_count' => $cronJobsCount + (int) ($runtimeCounts['scheduler'] ?? 0),
        ];
    }
}
