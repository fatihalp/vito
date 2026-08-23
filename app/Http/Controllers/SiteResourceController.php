<?php

namespace App\Http\Controllers;

use App\Actions\SiteResource\ConnectSiteResource;
use App\Actions\SiteResource\DisconnectSiteResource;
use App\Enums\ServerRole;
use App\Enums\SiteResourceStatus;
use App\Http\Resources\SiteResourceResource;
use App\Http\Resources\SiteResourceServerOptionResource;
use App\Http\Resources\StorageProviderResource;
use App\Models\Server;
use App\Models\Site;
use App\Models\SiteResource;
use App\Models\StorageProvider;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Delete;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Post;
use Spatie\RouteAttributes\Attributes\Prefix;

#[Prefix('servers/{server}/sites/{site}/resources')]
#[Middleware(['auth', 'has-project'])]
class SiteResourceController extends Controller
{

    #[Get('/', name: 'site-resources')]
    public function index(Server $server, Site $site): Response
    {
        $this->authorize('viewAny', [SiteResource::class, $site, $server]);

        $project = $server->project;

        return Inertia::render('site-resources/index', [
            'resources' => SiteResourceResource::collection(
                $site->resources()->with(['server', 'storageProvider'])->latest()->get()
            ),
            'servers' => SiteResourceServerOptionResource::collection(
                $project->servers()
                    ->where(function (Builder $query) use ($site): void {
                        $query->whereIn('role', [ServerRole::DATABASE->value, ServerRole::CACHE->value])
                            ->orWhere('id', $site->server_id);
                    })
                    ->whereIn('status', ['ready', 'updating'])
                    ->orderBy('name')
                    ->get()
            ),
            'storageProviders' => StorageProviderResource::collection(
                StorageProvider::getByProjectId($project->id, user())->orderBy('profile')->get()
            ),
        ]);
    }

    #[Get('/{resource}/reveal', name: 'site-resources.reveal')]
    public function reveal(Server $server, Site $site, SiteResource $resource): JsonResponse
    {
        $this->authorize('view', [$resource, $site, $server]);

        $target = $resource->server
            ? $resource->server->name
            : ($resource->storageProvider ? $resource->storageProvider->profile : 'Resource');

        return response()->json([
            'type' => $resource->type->getText(),
            'target' => $target,
            'environment' => $resource->environment,
        ]);
    }

    #[Post('/', name: 'site-resources.store')]
    public function store(Request $request, Server $server, Site $site): RedirectResponse
    {
        $this->authorize('create', [SiteResource::class, $site, $server]);

        $resource = app(ConnectSiteResource::class)->connect($site, $request->all());

        return $resource->status === SiteResourceStatus::READY
            ? back()->with('success', 'Resource connected and environment configured successfully.')
            : back()->with('info', 'Resource connection started. Environment settings activate after networking is ready.');
    }

    #[Delete('/{resource}', name: 'site-resources.destroy')]
    public function destroy(Server $server, Site $site, SiteResource $resource): RedirectResponse
    {
        $this->authorize('delete', [$resource, $site, $server]);

        app(DisconnectSiteResource::class)->disconnect($resource);

        return back()->with('success', 'Resource disconnected and previous environment restored.');
    }
}
