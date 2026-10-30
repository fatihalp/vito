<?php

namespace App\Http\Middleware;

use App\Actions\Bootstrap\GetBootstrap;
use App\Actions\Server\EnsureSelfServerExists;
use App\Http\Resources\NetworkResource;
use App\Http\Resources\ProjectResource;
use App\Http\Resources\ServerResource;
use App\Http\Resources\SiteResource;
use App\Http\Resources\UserResource;
use App\Models\Network;
use App\Models\Server;
use App\Models\Site;
use App\Models\UserProject;
use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    
    protected $rootView = 'app';

    
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    
    public function share(Request $request): array
    {
        $user = $request->user();
        if ($user) {
            $user->load(['projects' => fn ($query) => $query->forResource($user)]);
        }

        $currentProject = $user
            ? ($user->projects->firstWhere('id', $user->current_project_id) ?? $user->currentProject)
            : null;
        $canSeeCurrentProject = $user && $currentProject && $user->can('view', $currentProject);

        if ($user && (! $currentProject || ! $canSeeCurrentProject)) {
            $currentProject = $user->ensureHasDefaultProject();
            $user->load(['projects' => fn ($query) => $query->forResource($user)]);
            $currentProject = $user->projects->firstWhere('id', $currentProject->id) ?? $currentProject;
        }

        $data = [];
        if ($request->route('server')) {
            $server = $request->route('server');
            if (! ($server instanceof Server)) {
                $server = Server::find($server);
            }
            if ($server) {
                if ($server->is_self) {
                    $server = app(EnsureSelfServerExists::class)->ensure($user) ?? $server;
                }

                $request->route()?->setParameter('server', $server);

                $serverProject = $user?->projects->firstWhere('id', $server->project_id) ?? $server->project;
                if ($serverProject) {
                    $server->setRelation('project', $serverProject);
                }

                if ($user && $user->can('view', $server)) {
                    if ($user->current_project_id !== $server->project_id) {
                        $user->current_project_id = $server->project_id;
                        $user->save();
                    }

                    $currentProject = $serverProject;
                }
            }

            $serverLoaded = false;
            $resolveServer = function () use ($server, &$serverLoaded): ?Server {
                if ($server && ! $serverLoaded) {
                    $server->loadForResource();
                    $serverLoaded = true;
                }

                return $server;
            };

            $data['server'] = fn (): ?ServerResource => $server ? ServerResource::make($resolveServer()) : null;

            if ($request->route('site')) {
                $site = $request->route('site');
                if (! ($site instanceof Site)) {
                    $site = Site::find($site);
                }
                if ($site) {
                    if ($server && $site->server_id === $server->id) {
                        $site->setRelation('server', $server);
                    }
                    $request->route()?->setParameter('site', $site);
                    $data['site'] = function () use ($site, $resolveServer): SiteResource {
                        $loadedServer = $resolveServer();
                        if ($loadedServer && $site->server_id === $loadedServer->id) {
                            $site->setRelation('server', $loadedServer);
                        }

                        return SiteResource::make($site->loadForResource());
                    };
                }
            }
        }

        if ($request->route('network')) {
            $network = $request->route('network');
            if (! ($network instanceof Network)) {
                $network = Network::find($network);
            }
            if ($network) {
                $request->route()?->setParameter('network', $network);

                $networkProject = $user?->projects->firstWhere('id', $network->project_id) ?? $network->project;
                if ($networkProject) {
                    $network->setRelation('project', $networkProject);
                }

                if ($user && $user->can('view', $network)) {
                    if ($user->current_project_id !== $network->project_id) {
                        $user->current_project_id = $network->project_id;
                        $user->save();
                    }

                    $currentProject = $networkProject;

                    $data['network'] = fn (): NetworkResource => NetworkResource::make(
                        $network->load('serverProvider')->loadCount('servers')
                    );
                }
            }
        }

        if ($currentProject && $user) {
            $currentProject = $user->projects->firstWhere('id', $currentProject->id) ?? $currentProject;
            $user->setRelation('currentProject', $currentProject);
        }

        return [
            ...parent::share($request),
            ...$data,
            'name' => config('app.name'),
            'version' => config('app.version'),
            'env' => config('app.env'),
            'demo' => config('app.demo'),
            'quote' => function (): array {
                [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

                return ['message' => trim($message), 'author' => trim($author)];
            },
            'auth' => fn (): ?array => $user ? [
                'user' => UserResource::make($user),
                'currentProject' => $currentProject ? ProjectResource::make(
                    $currentProject->servers_count === null
                        ? $currentProject->loadCount(['servers', 'sites'])
                        : $currentProject
                ) : null,
                'pendingInvitationsCount' => UserProject::query()
                    ->where('email', $user->email)
                    ->whereNull('user_id')
                    ->whereHas('project')
                    ->count(),
            ] : null,
            'csrf_token' => csrf_token(),
            'bootstrap_version' => fn (): string => app(GetBootstrap::class)->version(),
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
                'danger' => fn () => $request->session()->get('danger'),
                'warning' => fn () => $request->session()->get('warning'),
                'info' => fn () => $request->session()->get('info'),
                'gray' => fn () => $request->session()->get('gray'),
                'data' => fn () => $request->session()->get('data'),
            ],
        ];
    }
}
