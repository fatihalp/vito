<?php

namespace App\Http\Controllers;

use App\Actions\Ci\CancelCiRun;
use App\Actions\Ci\ConfigureCiRunner;
use App\Actions\Ci\GetCiRunLog;
use App\Actions\Ci\GetCiRunnerOverview;
use App\Actions\Ci\ListCiRuns;
use App\Actions\Ci\ResolveCiRunnerTargetServer;
use App\Actions\Ci\StartCiRun;
use App\Models\CiRunner;
use App\Models\Server;
use App\Models\Site;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Post;
use Spatie\RouteAttributes\Attributes\Prefix;

#[Prefix('/servers/{server}/sites/{site}/ci')]
#[Middleware(['auth', 'throttle:90,1'])]
class SiteCiController extends Controller
{
    #[Get('/', name: 'site-ci')]
    public function index(Request $request, Server $server, Site $site, GetCiRunnerOverview $action): Response
    {
        $this->authorize('viewAny', [CiRunner::class, $site, $server]);

        return Inertia::render('site-ci/index', $action->get($request->user(), $server, $site));
    }

    #[Post('/settings', name: 'site-ci.settings')]
    public function configure(
        Request $request,
        Server $server,
        Site $site,
        ResolveCiRunnerTargetServer $targetServer,
        ConfigureCiRunner $action,
    ): JsonResponse {
        $this->authorize('configure', [CiRunner::class, $site, $server]);
        $this->authorize('update', $targetServer->resolve($request->all()));
        $action->configure($site, $request->all());

        return $this->privateJson(['message' => 'CI runner connected.']);
    }

    #[Get('/data', name: 'site-ci.data')]
    public function data(Server $server, Site $site, ListCiRuns $action): JsonResponse
    {
        $this->authorize('viewAny', [CiRunner::class, $site, $server]);

        return $this->privateJson($action->list($site));
    }

    #[Post('/run', name: 'site-ci.run')]
    public function run(Request $request, Server $server, Site $site, StartCiRun $action): JsonResponse
    {
        $this->authorize('run', [CiRunner::class, $site, $server]);

        return $this->privateJson(['run' => $action->start($site, $request->all())], 202);
    }

    #[Get('/{runId}/log', name: 'site-ci.log')]
    public function log(Request $request, Server $server, Site $site, string $runId, GetCiRunLog $action): JsonResponse
    {
        $this->authorize('viewAny', [CiRunner::class, $site, $server]);

        return $this->privateJson($action->get($site, $runId, $request->all()));
    }

    #[Post('/{runId}/cancel', name: 'site-ci.cancel')]
    public function cancel(Server $server, Site $site, string $runId, CancelCiRun $action): JsonResponse
    {
        $this->authorize('run', [CiRunner::class, $site, $server]);

        return $this->privateJson(['cancel_requested' => $action->cancel($site, $runId)]);
    }

    private function privateJson(array $payload, int $status = 200): JsonResponse
    {
        return response()->json($payload, $status)->header('Cache-Control', 'private, no-store');
    }
}
