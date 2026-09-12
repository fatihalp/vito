<?php

namespace App\Http\Controllers;

use App\Actions\Site\Deploy;
use App\Actions\Site\GetEnv;
use App\Actions\Site\GetSiteOverview;
use App\Actions\Site\ParseEnv;
use App\Actions\Site\Rollback;
use App\Actions\Site\StringifyEnv;
use App\Actions\Site\UpdateDeploymentScript;
use App\Actions\Site\UpdateEnv;
use App\Actions\Site\UpdateLoadBalancer;
use App\Http\Resources\DeploymentScriptResource;
use App\Http\Resources\DeploymentResource;
use App\Http\Resources\CronJobResource;
use App\Http\Resources\LoadBalancerServerResource;
use App\Http\Resources\WorkerResource;
use App\Actions\Domain\ToggleDomainProxy;
use App\Models\Deployment;
use App\Models\DeploymentScript;
use App\Models\Server;
use App\Models\Site;
use App\SiteTypes\AbstractProxiedSiteType;
use App\Tables\DeploymentTable;
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
use Spatie\RouteAttributes\Attributes\Put;

#[Prefix('/servers/{server}/sites/{site}')]
#[Middleware(['auth', 'has-project'])]
class ApplicationController extends Controller
{

    #[Get('/', name: 'application')]
    public function index(Server $server, Site $site): Response
    {
        $this->authorize('view', [$site, $server]);

        if ($server->isReady()) {
            $site->ensureDeploymentScriptsExist();
        }

        $overview = null;
        $getOverview = function () use ($site, &$overview): array {
            return $overview ??= app(GetSiteOverview::class)->get($site);
        };

        return Inertia::render('application/index', [
            'deployments' => Inertia::defer(fn () => DeploymentTable::make($site->deployments())->overview(), 'deployments'),
            'deploymentScript' => Inertia::defer(fn () => $site->deploymentScript ? new DeploymentScriptResource($site->deploymentScript) : null, 'deployments'),
            'buildScript' => Inertia::defer(fn () => $site->buildScript ? new DeploymentScriptResource($site->buildScript) : null, 'deployments'),
            'preFlightScript' => Inertia::defer(fn () => $site->preFlightScript ? new DeploymentScriptResource($site->preFlightScript) : null, 'deployments'),
            'loadBalancerServers' => $site->type === 'load-balancer'
                ? LoadBalancerServerResource::collection($site->loadBalancerServers)
                : [],
            'worker' => Inertia::defer(function () use ($site) {
                $type = $site->typeOrNull();
                return $type instanceof AbstractProxiedSiteType && $type->bootstrapWorker()
                    ? new WorkerResource($type->bootstrapWorker())
                    : null;
            }, 'deployments'),
            'overviewWorkers' => Inertia::defer(fn () => WorkerResource::collection($getOverview()['workers']), 'overview'),
            'overviewWorkersCount' => Inertia::defer(fn () => $getOverview()['workers_count'], 'overview'),
            'overviewCronJobs' => Inertia::defer(fn () => CronJobResource::collection($getOverview()['cron_jobs']), 'overview'),
            'overviewCronJobsCount' => Inertia::defer(fn () => $getOverview()['cron_jobs_count'], 'overview'),
        ]);
    }

    #[Post('/toggle-domain-proxy', name: 'sites.toggle-domain-proxy')]
    public function toggleDomainProxy(Request $request, Server $server, Site $site): RedirectResponse
    {
        $this->authorize('update', [$site, $server]);

        $request->validate([
            'domain' => ['required', 'string'],
            'proxied' => ['nullable', 'boolean'],
        ]);

        app(ToggleDomainProxy::class)->toggle(
            $site,
            $request->input('domain'),
            $request->has('proxied') ? $request->boolean('proxied') : null
        );

        return back()->with('success', 'Domain Cloudflare proxy status updated.');
    }

    #[Get('/deployments', name: 'application.deployments.index')]
    public function deployments(Server $server, Site $site): Response
    {
        $this->authorize('view', [$site, $server]);

        return Inertia::render('application/deployments/index', [
            'deployments' => DeploymentTable::make($site->deployments())->paginate(),
        ]);
    }

    #[Get('/deployments/{deployment}', name: 'application.deployments.show')]
    public function showDeployment(Server $server, Site $site, Deployment $deployment): Response
    {
        $this->authorize('view', [$site, $server]);

        if ($deployment->site_id !== $site->id) {
            abort(404);
        }

        return Inertia::render('application/deployments/show', [
            'deployment' => new DeploymentResource($deployment->load('log')),
        ]);
    }

    #[Put('/deployment-scripts/{deploymentScript}', name: 'application.update-deployment-script')]
    public function updateScript(Request $request, Server $server, Site $site, DeploymentScript $deploymentScript): RedirectResponse
    {
        $this->authorize('update', [$site, $server]);

        app(UpdateDeploymentScript::class)->update($deploymentScript, $request->input());

        return back()->with('success', 'Deployment script updated successfully.');
    }

    

    #[Post('/deploy', name: 'application.deploy')]
    public function deploy(Server $server, Site $site): RedirectResponse
    {
        $this->authorize('update', [$site, $server]);

        app(Deploy::class)->run($site);

        return back()->with('info', 'Deployment started, please wait...');
    }

    #[Post('/rollback/{deployment}', name: 'application.rollback')]
    public function rollback(Server $server, Site $site, Deployment $deployment): RedirectResponse
    {
        $this->authorize('update', [$site, $server]);

        if ($deployment->site_id !== $site->id) {
            return back()->with('error', 'Invalid deployment selected for rollback.');
        }

        app(Rollback::class)->run($deployment);

        return back()->with('info', 'Rollback started, please wait...');
    }

    #[Delete('/deployments/{deployment}', name: 'application.deployments.destroy')]
    public function destroyDeployment(Server $server, Site $site, Deployment $deployment): RedirectResponse
    {
        $this->authorize('update', [$site, $server]);

        if ($deployment->site_id !== $site->id) {
            abort(404);
        }

        $deployment->remove();

        return back()->with('success', 'Deployment removed successfully.');
    }

    

    #[Get('/environment', name: 'application.environment')]
    public function environment(Server $server, Site $site): Response
    {
        $this->authorize('view', [$site, $server]);

        return Inertia::render('application/environment/index', [
            'defaultPath' => $site->type_data['env_path'] ?? ($site->path ? "{$site->path}/.env" : null),
        ]);
    }

    #[Get('/env', name: 'application.env')]
    public function env(Request $request, Server $server, Site $site): JsonResponse
    {
        $this->authorize('view', [$site, $server]);

        $input = $request->input('env');
        $path = is_string($input) && $input !== '' ? $input : null;
        $canReveal = $request->user()->can('revealEnv', [$site, $server]);

        if ($path !== null && $path !== $site->resolveEnvPath()) {
            $this->authorize('update', [$site, $server]);
        }

        $data = app(GetEnv::class)->get($site, $path, $canReveal);

        return response()->json([...$data, 'can_edit' => $canReveal]);
    }

    

    #[Post('/env/parse', name: 'application.parse-env')]
    public function parseEnv(Request $request, Server $server, Site $site): JsonResponse
    {
        $this->authorize('view', [$site, $server]);

        return response()->json(app(ParseEnv::class)->parse($request->all()));
    }

    

    #[Post('/env/stringify', name: 'application.stringify-env')]
    public function stringifyEnv(Request $request, Server $server, Site $site): JsonResponse
    {
        $this->authorize('view', [$site, $server]);

        return response()->json(app(StringifyEnv::class)->stringify($request->all()));
    }

    

    #[Put('/env', name: 'application.update-env')]
    public function updateEnv(Request $request, Server $server, Site $site): RedirectResponse
    {
        $this->authorize('update', [$site, $server]);

        app(UpdateEnv::class)->update($site, $request->input());

        return back()->with('success', '.env file updated successfully.');
    }

    

    #[Post('/enable-auto-deployment', name: 'application.enable-auto-deployment')]
    public function enableAutoDeployment(Server $server, Site $site): RedirectResponse
    {
        $this->authorize('update', [$site, $server]);

        if (! $site->sourceControl) {
            return back()->with('error', 'Cannot find source control for this site.');
        }

        $site->enableAutoDeployment();

        return back()->with('success', 'Auto deployment enabled successfully.');
    }

    

    #[Post('/disable-auto-deployment', name: 'application.disable-auto-deployment')]
    public function disableAutoDeployment(Server $server, Site $site): RedirectResponse
    {
        $this->authorize('update', [$site, $server]);

        if (! $site->sourceControl) {
            return back()->with('error', 'Cannot find source control for this site.');
        }

        $site->disableAutoDeployment();

        return back()->with('success', 'Auto deployment disabled successfully.');
    }

    #[Post('/load-balancer', name: 'application.update-load-balancer')]
    public function updateLoadBalancer(Request $request, Server $server, Site $site): RedirectResponse
    {
        $this->authorize('update', [$site, $server]);

        app(UpdateLoadBalancer::class)->update($site, $request->input());

        return back()->with('success', 'Load balancer updated successfully.');
    }
}
