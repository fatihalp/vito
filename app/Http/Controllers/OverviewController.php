<?php

namespace App\Http\Controllers;

use App\Actions\Projects\GetOverviewResources;
use App\Http\Resources\ProjectOverviewServerResource;
use App\Http\Resources\ProjectOverviewSiteResource;
use App\Models\DNSProvider;
use App\Models\ServerProvider;
use App\Models\SourceControl;
use App\Models\StorageProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;

#[Middleware(['auth', 'has-project'])]
class OverviewController extends Controller
{

    #[Get('/overview', name: 'overview')]
    public function __invoke(): Response
    {
        $this->authorize('view', user()->currentProject);

        return Inertia::render('overview');
    }

    #[Get('/overview/resources', name: 'overview.resources')]
    public function resources(Request $request): JsonResponse
    {
        $this->authorize('view', user()->currentProject);
        $project = user()->currentProject;
        $user = user();

        $resources = app(GetOverviewResources::class)->get(
            $project,
            $request->only(['servers', 'sites', 'fallback_server_id']),
        );

        $projects = $user->allProjects()
            ->withCount('users')
            ->latest('projects.id')
            ->take(3)
            ->get()
            ->map(fn ($p) => [
                'id' => $p->id,
                'name' => $p->name,
                'users_count' => $p->users_count,
                'is_current' => $p->id === $project->id,
                'created_at' => $p->created_at?->toIso8601String(),
            ]);

        $serverProviders = ServerProvider::getByProjectId($project->id, $user)
            ->latest()
            ->take(3)
            ->get()
            ->map(fn ($sp) => [
                'id' => $sp->id,
                'provider' => $sp->provider,
                'profile' => $sp->name ?? $sp->profile ?? $sp->provider,
                'connected' => (bool) $sp->connected,
                'created_at' => $sp->created_at?->toIso8601String(),
            ]);

        $sourceControls = SourceControl::getByProjectId($project->id, $user)
            ->latest()
            ->take(3)
            ->get()
            ->map(fn ($sc) => [
                'id' => $sc->id,
                'provider' => $sc->provider,
                'username' => $sc->username ?? $sc->provider,
                'connected' => (bool) $sc->connected,
                'created_at' => $sc->created_at?->toIso8601String(),
            ]);

        $storageProviders = StorageProvider::getByProjectId($project->id, $user)
            ->latest()
            ->take(3)
            ->get()
            ->map(fn ($sp) => [
                'id' => $sp->id,
                'provider' => $sp->provider,
                'profile' => $sp->profile ?? $sp->provider,
                'connected' => (bool) $sp->connected,
                'created_at' => $sp->created_at?->toIso8601String(),
            ]);

        $dnsProviders = DNSProvider::getByProjectId($project->id, $user)
            ->latest()
            ->take(3)
            ->get()
            ->map(fn ($dp) => [
                'id' => $dp->id,
                'provider' => $dp->provider,
                'profile' => $dp->name ?? $dp->profile ?? $dp->provider,
                'connected' => (bool) $dp->connected,
                'created_at' => $dp->created_at?->toIso8601String(),
            ]);

        $backups = $project->backups()
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

        $domains = $project->domains()
            ->with('dnsProvider')
            ->latest()
            ->take(3)
            ->get()
            ->map(fn ($d) => [
                'id' => $d->id,
                'domain' => $d->domain,
                'provider_name' => $d->dnsProvider?->name ?? $d->dnsProvider?->provider,
                'created_at' => $d->created_at?->toIso8601String(),
            ]);

        return response()->json([
            'servers' => ProjectOverviewServerResource::collection($resources['servers'])->resolve(),
            'sites' => ProjectOverviewSiteResource::collection($resources['sites'])->resolve(),
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
