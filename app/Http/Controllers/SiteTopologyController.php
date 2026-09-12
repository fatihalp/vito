<?php

namespace App\Http\Controllers;

use App\Actions\Site\GetSiteOverview;
use App\Actions\Site\ResolveDomainProxyStatuses;
use App\Http\Resources\DNSProviderResource;
use App\Http\Resources\HostedDomainResource;
use App\Http\Resources\SiteResourceResource;
use App\Models\DNSProvider;
use App\Models\Server;
use App\Models\Site;
use App\Models\SiteResource;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Prefix;

#[Prefix('/servers/{server}/sites/{site}/topology')]
#[Middleware(['auth', 'has-project'])]
class SiteTopologyController extends Controller
{
    #[Get('/', name: 'site-topology')]
    public function index(Server $server, Site $site): Response
    {
        $this->authorize('view', [$site, $server]);

        $user = user();
        $overview = app(GetSiteOverview::class)->get($site);

        return Inertia::render('site-topology/index', [
            'resources' => SiteResourceResource::collection(
                $site->resources()->with(['server', 'storageProvider'])->get()
            ),
            'hostedDomains' => HostedDomainResource::collection(
                $site->hostedDomains()->with('ssl')->get()
            ),
            'dnsProviders' => DNSProviderResource::collection(
                DNSProvider::getByProjectId($user->current_project_id, $user)->where('connected', true)->get()
            ),
            'domainProxyStatus' => app(ResolveDomainProxyStatuses::class)->resolve($site),
            'overviewWorkersCount' => $overview['workers_count'] ?? 0,
            'overviewCronJobsCount' => $overview['cron_jobs_count'] ?? 0,
        ]);
    }
}
