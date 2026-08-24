<?php

namespace App\Http\Controllers;

use App\Http\Resources\ProjectOverviewServerResource;
use App\Http\Resources\ProjectOverviewSiteResource;
use App\Models\Backup;
use App\Models\DNSProvider;
use App\Models\Domain;
use App\Models\Project;
use App\Models\Server;
use App\Models\ServerProvider;
use App\Models\Site;
use App\Models\SourceControl;
use App\Models\StorageProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;

#[Middleware(['auth'])]
class OverviewController extends Controller
{

    #[Get('/overview', name: 'overview')]
    public function __invoke(): Response
    {
        return Inertia::render('overview');
    }

    #[Get('/overview/resources', name: 'overview.resources')]
    public function resources(Request $request): JsonResponse
    {
        $user = user();
        $isAdmin = $user && method_exists($user, 'isAdmin') && $user->isAdmin();
        $currentProject = $user->currentProject;

        $serverIds = array_filter(array_map('intval', (array) $request->input('servers', [])));
        $siteIds = array_filter(array_map('intval', (array) $request->input('sites', [])));

        if ($isAdmin) {
            // Servers: prioritize requested recent servers, fallback to latest across all projects
            if (!empty($serverIds)) {
                $servers = Server::whereKey($serverIds)->with('latestMetric')->get();
                if ($servers->count() < 3) {
                    $extraServers = Server::whereNotIn('id', $servers->pluck('id'))
                        ->latest('id')
                        ->limit(3 - $servers->count())
                        ->with('latestMetric')
                        ->get();
                    $servers = $servers->concat($extraServers);
                }
            } else {
                $servers = Server::query()->latest('id')->limit(3)->with('latestMetric')->get();
            }

            // Sites: prioritize requested recent sites, fallback to latest across all projects
            if (!empty($siteIds)) {
                $sites = Site::with('server')->whereKey($siteIds)->get();
                if ($sites->count() < 3) {
                    $extraSites = Site::with('server')
                        ->whereNotIn('id', $sites->pluck('id'))
                        ->latest('id')
                        ->limit(3 - $sites->count())
                        ->get();
                    $sites = $sites->concat($extraSites);
                }
            } else {
                $sites = Site::query()->with('server')->latest('id')->limit(3)->get();
            }

            $projects = Project::query()
                ->withCount('users')
                ->latest('projects.id')
                ->take(3)
                ->get()
                ->map(fn ($p) => [
                    'id' => $p->id,
                    'name' => $p->name,
                    'users_count' => $p->users_count,
                    'is_current' => $p->id === $currentProject?->id,
                    'created_at' => $p->created_at?->toIso8601String(),
                ]);

            $serverProviders = ServerProvider::query()
                ->latest('id')
                ->take(3)
                ->get()
                ->map(fn ($sp) => [
                    'id' => $sp->id,
                    'provider' => $sp->provider,
                    'profile' => $sp->name ?? $sp->profile ?? $sp->provider,
                    'connected' => (bool) $sp->connected,
                    'created_at' => $sp->created_at?->toIso8601String(),
                ]);

            $sourceControls = SourceControl::query()
                ->latest('id')
                ->take(3)
                ->get()
                ->map(fn ($sc) => [
                    'id' => $sc->id,
                    'provider' => $sc->provider,
                    'username' => $sc->username ?? $sc->provider,
                    'connected' => (bool) $sc->connected,
                    'created_at' => $sc->created_at?->toIso8601String(),
                ]);

            $storageProviders = StorageProvider::query()
                ->latest('id')
                ->take(3)
                ->get()
                ->map(fn ($sp) => [
                    'id' => $sp->id,
                    'provider' => $sp->provider,
                    'profile' => $sp->profile ?? $sp->provider,
                    'connected' => (bool) $sp->connected,
                    'created_at' => $sp->created_at?->toIso8601String(),
                ]);

            $dnsProviders = DNSProvider::query()
                ->latest('id')
                ->take(3)
                ->get()
                ->map(fn ($dp) => [
                    'id' => $dp->id,
                    'provider' => $dp->provider,
                    'profile' => $dp->name ?? $dp->profile ?? $dp->provider,
                    'connected' => (bool) $dp->connected,
                    'created_at' => $dp->created_at?->toIso8601String(),
                ]);

            $backups = Backup::query()
                ->with('server')
                ->latest('backups.id')
                ->take(3)
                ->get()
                ->map(fn ($b) => [
                    'id' => $b->id,
                    'name' => $b->name,
                    'server_id' => $b->server_id,
                    'server_name' => $b->server?->name,
                    'schedule' => $b->schedule,
                    'retention' => $b->retention,
                    'created_at' => $b->created_at?->toIso8601String(),
                ]);

            $domains = Domain::query()
                ->with('dnsProvider')
                ->latest('domains.id')
                ->take(3)
                ->get()
                ->map(fn ($d) => [
                    'id' => $d->id,
                    'domain' => $d->domain,
                    'provider_name' => $d->dnsProvider?->name ?? $d->dnsProvider?->provider,
                    'created_at' => $d->created_at?->toIso8601String(),
                ]);
        } else {
            $projectIds = $user->allProjects()->pluck('projects.id')->toArray();

            // Servers: prioritize requested recent servers in user projects, fallback to latest
            if (!empty($serverIds)) {
                $servers = Server::whereIn('project_id', $projectIds)->whereKey($serverIds)->with('latestMetric')->get();
                if ($servers->count() < 3) {
                    $extraServers = Server::whereIn('project_id', $projectIds)
                        ->whereNotIn('id', $servers->pluck('id'))
                        ->latest('id')
                        ->limit(3 - $servers->count())
                        ->with('latestMetric')
                        ->get();
                    $servers = $servers->concat($extraServers);
                }
            } else {
                $servers = Server::whereIn('project_id', $projectIds)->latest('id')->limit(3)->with('latestMetric')->get();
            }

            // Sites: prioritize requested recent sites in user projects, fallback to latest
            if (!empty($siteIds)) {
                $sites = Site::with('server')
                    ->whereHas('server', fn ($q) => $q->whereIn('project_id', $projectIds))
                    ->whereKey($siteIds)
                    ->get();
                if ($sites->count() < 3) {
                    $extraSites = Site::with('server')
                        ->whereHas('server', fn ($q) => $q->whereIn('project_id', $projectIds))
                        ->whereNotIn('id', $sites->pluck('id'))
                        ->latest('id')
                        ->limit(3 - $sites->count())
                        ->get();
                    $sites = $sites->concat($extraSites);
                }
            } else {
                $sites = Site::whereHas('server', fn ($q) => $q->whereIn('project_id', $projectIds))
                    ->with('server')
                    ->latest('id')
                    ->limit(3)
                    ->get();
            }

            $projects = $user->allProjects()
                ->withCount('users')
                ->latest('projects.id')
                ->take(3)
                ->get()
                ->map(fn ($p) => [
                    'id' => $p->id,
                    'name' => $p->name,
                    'users_count' => $p->users_count,
                    'is_current' => $p->id === $currentProject?->id,
                    'created_at' => $p->created_at?->toIso8601String(),
                ]);

            $serverProviders = ServerProvider::where(function ($q) use ($projectIds, $user) {
                $q->whereIn('project_id', $projectIds)->orWhere('user_id', $user->id);
            })
                ->latest('id')
                ->take(3)
                ->get()
                ->map(fn ($sp) => [
                    'id' => $sp->id,
                    'provider' => $sp->provider,
                    'profile' => $sp->name ?? $sp->profile ?? $sp->provider,
                    'connected' => (bool) $sp->connected,
                    'created_at' => $sp->created_at?->toIso8601String(),
                ]);

            $sourceControls = SourceControl::where(function ($q) use ($projectIds, $user) {
                $q->whereIn('project_id', $projectIds)->orWhere('user_id', $user->id);
            })
                ->latest('id')
                ->take(3)
                ->get()
                ->map(fn ($sc) => [
                    'id' => $sc->id,
                    'provider' => $sc->provider,
                    'username' => $sc->username ?? $sc->provider,
                    'connected' => (bool) $sc->connected,
                    'created_at' => $sc->created_at?->toIso8601String(),
                ]);

            $storageProviders = StorageProvider::where(function ($q) use ($projectIds, $user) {
                $q->whereIn('project_id', $projectIds)->orWhere('user_id', $user->id);
            })
                ->latest('id')
                ->take(3)
                ->get()
                ->map(fn ($sp) => [
                    'id' => $sp->id,
                    'provider' => $sp->provider,
                    'profile' => $sp->profile ?? $sp->provider,
                    'connected' => (bool) $sp->connected,
                    'created_at' => $sp->created_at?->toIso8601String(),
                ]);

            $dnsProviders = DNSProvider::where(function ($q) use ($projectIds, $user) {
                $q->whereIn('project_id', $projectIds)->orWhere('user_id', $user->id);
            })
                ->latest('id')
                ->take(3)
                ->get()
                ->map(fn ($dp) => [
                    'id' => $dp->id,
                    'provider' => $dp->provider,
                    'profile' => $dp->name ?? $dp->profile ?? $dp->provider,
                    'connected' => (bool) $dp->connected,
                    'created_at' => $dp->created_at?->toIso8601String(),
                ]);

            $backups = Backup::whereHas('server', fn ($q) => $q->whereIn('project_id', $projectIds))
                ->with('server')
                ->latest('backups.id')
                ->take(3)
                ->get()
                ->map(fn ($b) => [
                    'id' => $b->id,
                    'name' => $b->name,
                    'server_id' => $b->server_id,
                    'server_name' => $b->server?->name,
                    'schedule' => $b->schedule,
                    'retention' => $b->retention,
                    'created_at' => $b->created_at?->toIso8601String(),
                ]);

            $domains = Domain::where(function ($q) use ($projectIds, $user) {
                $q->whereIn('project_id', $projectIds)->orWhere('user_id', $user->id);
            })
                ->with('dnsProvider')
                ->latest('domains.id')
                ->take(3)
                ->get()
                ->map(fn ($d) => [
                    'id' => $d->id,
                    'domain' => $d->domain,
                    'provider_name' => $d->dnsProvider?->name ?? $d->dnsProvider?->provider,
                    'created_at' => $d->created_at?->toIso8601String(),
                ]);
        }

        return response()->json([
            'servers' => ProjectOverviewServerResource::collection($servers)->resolve(),
            'sites' => ProjectOverviewSiteResource::collection($sites)->resolve(),
            'projects' => $projects,
            'server_providers' => $serverProviders,
            'source_controls' => $sourceControls,
            'storage_providers' => $storageProviders,
            'dns_providers' => $dnsProviders,
            'backups' => $backups,
            'domains' => $domains,
        ]);
    }
}
