<?php

namespace App\Actions\Site;

use App\Enums\DeploymentStatus;
use App\Models\Project;
use App\Models\Site;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Relations\Relation;

class GetOverviewSites
{
    /**
     * @param  array<int, int>  $siteIds
     * @return Collection<int, Site>
     */
    public function forProject(Project $project, array $siteIds, ?int $serverId = null): Collection
    {
        $sites = $project->sites()->whereKey($siteIds);

        if ($serverId !== null) {
            $sites->where('sites.server_id', $serverId);
        }

        return $this->get($sites);
    }

    /**
     * @param  Relation<Site, Project, mixed>  $sites
     * @return Collection<int, Site>
     */
    private function get(Relation $sites): Collection
    {
        return $sites
            ->with(['server', 'hostedDomains.ssl', 'workers'])
            ->withExists([
                'deployments as has_finished_deployment' => fn ($query) => $query->where('status', DeploymentStatus::FINISHED),
            ])
            ->get();
    }
}
