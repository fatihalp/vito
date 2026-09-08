<?php

namespace App\Actions\Projects;

use App\Actions\Site\GetOverviewSites;
use App\Models\Project;
use App\Models\Site;
use Illuminate\Support\Facades\Validator;

class GetOverviewResources
{
    
    public function get(Project $project, array $input): array
    {
        $validated = Validator::make($input, [
            'servers' => ['sometimes', 'array', 'max:25'],
            'servers.*' => ['integer', 'distinct'],
            'sites' => ['sometimes', 'array', 'max:25'],
            'sites.*' => ['integer', 'distinct'],
            'fallback_server_id' => ['sometimes', 'integer'],
        ])->validate();

        $sites = app(GetOverviewSites::class)->forProject(
            $project,
            $validated['sites'] ?? [],
            $validated['fallback_server_id'] ?? null,
        );

        if ($sites->isEmpty() && (isset($validated['fallback_server_id']) || empty($validated['sites']))) {
            $latestSiteIds = $project->sites()
                ->when(isset($validated['fallback_server_id']), fn ($query) => $query->where('sites.server_id', $validated['fallback_server_id']))
                ->latest('sites.created_at')
                ->orderByDesc('sites.id')
                ->limit(10)
                ->pluck('sites.id');

            if ($latestSiteIds->isNotEmpty()) {
                $sites = app(GetOverviewSites::class)->forProject(
                    $project,
                    $latestSiteIds->all(),
                    $validated['fallback_server_id'] ?? null,
                )->sortBy(fn (Site $site) => $latestSiteIds->search($site->id))->values();
            }
        }

        $serverIds = $validated['servers'] ?? [];
        $servers = $project->servers()
            ->when($serverIds, fn ($query) => $query->whereKey($serverIds), fn ($query) => $query->latest()->limit(10))
            ->with('latestMetric')
            ->get();

        return [
            'servers' => $servers,
            'sites' => $sites,
        ];
    }
}
