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
use Tighten\Ziggy\Ziggy;

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

        $ssrEnabled = (bool) config('inertia.ssr.enabled');

        
        $user = $request->user();
        $currentProject = $user?->currentProject;
        $canSeeCurrentProject = $user && $currentProject && $user->can('view', $currentProject);
        if ($user && (! $currentProject || ! $canSeeCurrentProject)) {
            $user->ensureHasDefaultProject();
            $user->unsetRelation('currentProject');
            $currentProject = $user->currentProject;
        }
        if ($currentProject) {
            $currentProject->loadCount(['servers', 'sites']);
        }

        $data = [];
        if ($request->route('server')) {
            
            $server = $request->route('server');
            if ($user && $user->can('view', $server) && $user->current_project_id !== $server->project_id) {
                $user->current_project_id = $server->project_id;
                $user->save();
            }

            if (! ($server instanceof Server)) {
                $server = Server::find($server);
            }
            if ($server) {
                $server->loadCount(['sites', 'cronJobs', 'workers', 'backups', 'services']);
            }

            $data['server'] = ServerResource::make($server);

            if ($request->route('site')) {
                $site = $request->route('site');
                if (! ($site instanceof Site)) {
                    $site = Site::find($site);
                }
                if ($site) {
                    $site->load('hostedDomains.ssl', 'workers')
                        ->loadCount(['hostedDomains', 'workers', 'resources', 'commands']);
                    $data['site'] = SiteResource::make($site);
                }
            }
        }

        if ($request->route('network')) {
            
            $network = $request->route('network');
            if ($user && $user->can('view', $network)) {
                if ($user->current_project_id !== $network->project_id) {
                    $user->current_project_id = $network->project_id;
                    $user->save();
                    $user->unsetRelation('currentProject');
                    $currentProject = $user->currentProject;
                }

                $data['network'] = fn () => NetworkResource::make(
                    $network->load('serverProvider')->loadCount('servers')
                );
            }
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
                'user' => UserResource::make($user->load('projects')),
                'currentProject' => ProjectResource::make($currentProject),
                'pendingInvitationsCount' => UserProject::query()
                    ->where('email', $user->email)
                    ->whereNull('user_id')
                    ->count(),
            ] : null,
            'csrf_token' => csrf_token(),
            'bootstrap_version' => app(GetBootstrap::class)->version(),
            ...($ssrEnabled ? [
                'ziggy' => fn (): array => [
                    ...(new Ziggy)->toArray(),
                    'location' => $request->url(),
                ],
            ] : []),
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
