<?php

namespace App\Http\Middleware;

use App\Actions\Bootstrap\GetBootstrap;
use App\Http\Resources\NetworkResource;
use App\Http\Resources\ProjectResource;
use App\Http\Resources\ServerResource;
use App\Http\Resources\SiteResource;
use App\Http\Resources\UserResource;
use App\Models\Network;
use App\Models\Server;
use App\Models\Site;
use App\Models\User;
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
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');


        
        $user = $request->user();
        $currentProject = $user?->currentProject;
        $canSeeCurrentProject = $user && $currentProject && $user->can('view', $currentProject);
        if ($user && (! $currentProject || ! $canSeeCurrentProject)) {
            $user->ensureHasDefaultProject();
            $user->unsetRelation('currentProject');
            $currentProject = $user->currentProject;
        }

        $data = [];
        if ($request->route('server')) {
            $server = $request->route('server');
            if (! ($server instanceof Server)) {
                $server = Server::find($server);
            }
            if ($server) {
                $server->loadForResource();

                if ($user && $user->can('view', $server)) {
                    if ($user->current_project_id !== $server->project_id) {
                        $user->current_project_id = $server->project_id;
                        $user->save();
                    }

                    $currentProject = $server->project;
                }
            }

            $data['server'] = ServerResource::make($server);

            if ($request->route('site')) {
                $site = $request->route('site');
                if (! ($site instanceof Site)) {
                    $site = Site::find($site);
                }
                if ($site) {
                    $site->load('hostedDomains.ssl', 'workers', 'gitHook')
                        ->loadCount(['hostedDomains', 'workers', 'resources', 'commands']);
                    $data['site'] = SiteResource::make($site);
                }
            }
        }

        if ($request->route('network')) {
            $network = $request->route('network');
            if (! ($network instanceof Network)) {
                $network = Network::find($network);
            }
            if ($network && $user && $user->can('view', $network)) {
                if ($user->current_project_id !== $network->project_id) {
                    $user->current_project_id = $network->project_id;
                    $user->save();
                }

                $currentProject = $network->project;

                $data['network'] = fn () => NetworkResource::make(
                    $network->load('serverProvider')->loadCount('servers')
                );
            }
        }

        if ($currentProject) {
            $currentProject->loadCount(['servers', 'sites']);
        }

        return [
            ...parent::share($request),
            ...$data,
            'name' => config('app.name'),
            'version' => config('app.version'),
            'env' => config('app.env'),
            'demo' => config('app.demo'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            'auth' => $user ? [
                'user' => UserResource::make($user->load(['projects' => fn ($query) => $query->forResource($user)])),
                'currentProject' => ProjectResource::make($currentProject),
                'pendingInvitationsCount' => UserProject::query()
                    ->where('email', $user->email)
                    ->whereNull('user_id')
                    ->whereHas('project')
                    ->count(),
            ] : null,
            'csrf_token' => csrf_token(),
            'bootstrap_version' => app(GetBootstrap::class)->version(),
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
