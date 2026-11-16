<?php

namespace App\Http\Controllers;

use App\Actions\Database\BrowsePostgresDatabase;
use App\Actions\SiteResource\ConnectSiteResource;
use App\Actions\SiteResource\DisconnectSiteResource;
use App\Actions\SiteResource\ResolveSiteResourceDatabaseName;
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
#[Middleware(['auth'])]
class SiteResourceController extends Controller
{
    #[Get('/{resource}/browse', name: 'site-resources.browse')]
    public function browse(
        Server $server,
        Site $site,
        SiteResource $resource,
        ResolveSiteResourceDatabaseName $databaseName,
    ): Response {
        $this->authorize('revealCredentials', [$resource, $site, $server]);

        $resourcesUrl = "/servers/{$server->id}/sites/{$site->id}/resources";

        return Inertia::render('databases/browse', [
            'databaseName' => $databaseName->resolve($resource),
            'dataUrl' => url("{$resourcesUrl}/{$resource->id}/browse/data"),
            'backUrl' => url($resourcesUrl),
        ]);
    }

    #[Get('/{resource}/browse/data', name: 'site-resources.browse.data')]
    public function browseData(
        Request $request,
        Server $server,
        Site $site,
        SiteResource $resource,
        BrowsePostgresDatabase $action,
    ): JsonResponse {
        $this->authorize('revealCredentials', [$resource, $site, $server]);

        return response()
            ->json($action->resource($resource, $request->query()))
            ->header('Cache-Control', 'no-store, private');
    }

    #[Get('/', name: 'site-resources')]
    public function index(Server $server, Site $site): Response
    {
        $this->authorize('viewAny', [SiteResource::class, $site, $server]);

        $project = $server->project;
        $user = user();
        $isAdmin = $user?->isAdmin() ?? false;

        $serversQuery = $isAdmin ? Server::query() : $project->servers();
        $storageProviders = $isAdmin
            ? StorageProvider::query()->orderBy('profile')->get()
            : StorageProvider::getByProjectId($project->id, $user)->orderBy('profile')->get();

        return Inertia::render('site-resources/index', [
            'resources' => SiteResourceResource::collection(
                $site->resources()->with(['server', 'storageProvider'])->latest()->get()
            ),
            'servers' => SiteResourceServerOptionResource::collection(
                $serversQuery
                    ->where(function (Builder $query) use ($site): void {
                        $query->whereIn('role', [ServerRole::DATABASE->value, ServerRole::CACHE->value])
                            ->orWhere('id', $site->server_id);
                    })
                    ->whereIn('status', ['ready', 'updating'])
                    ->with('services')
                    ->orderBy('name')
                    ->get()
            ),
            'storageProviders' => StorageProviderResource::collection($storageProviders),
        ]);
    }

    #[Get('/{resource}/reveal', name: 'site-resources.reveal')]
    public function reveal(Server $server, Site $site, SiteResource $resource): JsonResponse
    {
        $this->authorize('revealCredentials', [$resource, $site, $server]);

        $target = $resource->server
            ? $resource->server->name
            : ($resource->storageProvider ? $resource->storageProvider->profile : 'Resource');

        return response()->json([
            'type' => $resource->type->getText(),
            'target' => $target,
            'environment' => $resource->environment,
        ])->header('Cache-Control', 'no-store, private');
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
