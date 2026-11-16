<?php

namespace App\Http\Controllers;

use App\Actions\Ci\ConfigureCiRunner;
use App\Models\CiRunner;
use App\Models\Server;
use App\Models\Site;
use App\Services\Ci\CiRunData;
use App\Services\Ci\CiRunnerClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
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
    public function index(Request $request, Server $server, Site $site): Response
    {
        $this->authorize('viewAny', [CiRunner::class, $site, $server]);
        $canConfigure = $request->user()->can('configure', [CiRunner::class, $site, $server]);
        $runner = CiRunner::query()->where('site_id', $site->id)->with('server:id,name')->first();

        return Inertia::render('site-ci/index', [
            'runner' => $runner ? [
                'server_id' => $runner->server_id,
                'server_name' => $runner->server->name,
                'repository' => $runner->repository,
                'enabled' => $runner->enabled,
                ...($canConfigure ? ['user' => $runner->user, 'executable' => $runner->executable] : []),
            ] : null,
            'canConfigure' => $canConfigure,
            'canRun' => $request->user()->can('run', [CiRunner::class, $site, $server]),
            'runnerServers' => $canConfigure ? Server::query()->with('project')->where('is_self', false)->where('status', 'ready')->orderBy('name')->get(['id', 'name', 'project_id', 'is_self', 'status'])->filter(fn (Server $candidate): bool => $request->user()->can('update', $candidate))->map->only(['id', 'name'])->values() : [],
        ]);
    }

    #[Post('/settings', name: 'site-ci.settings')]
    public function configure(Request $request, Server $server, Site $site): JsonResponse
    {
        $this->authorize('configure', [CiRunner::class, $site, $server]);
        $target = $request->validate(['server_id' => ['required', 'integer']]);
        $this->authorize('update', Server::query()->findOrFail($target['server_id']));
        app(ConfigureCiRunner::class)->configure($site, $request->all());

        return response()->json(['message' => __('CI runner connected.')])->header('Cache-Control', 'private, no-store');
    }

    #[Get('/data', name: 'site-ci.data')]
    public function data(Server $server, Site $site, CiRunnerClient $client, CiRunData $presenter): JsonResponse
    {
        $this->authorize('viewAny', [CiRunner::class, $site, $server]);
        $runner = $this->runner($site);
        $runs = $client->request($runner, ['action' => 'list']);
        if (! array_is_list($runs) || count($runs) > 50) {
            throw ValidationException::withMessages(['ci' => __('The runner returned an invalid CI history.')]);
        }
        $data = [];
        foreach ($runs as $run) {
            if (! is_array($run)) {
                throw ValidationException::withMessages(['ci' => __('The runner returned invalid CI result data.')]);
            }
            $client->assertRun($runner, $run);
            $data[] = $presenter->present($run);
        }

        return response()->json(['runs' => $data, 'stages' => $client->info($runner)['stages']])->header('Cache-Control', 'private, no-store');
    }

    #[Post('/run', name: 'site-ci.run')]
    public function run(Request $request, Server $server, Site $site, CiRunnerClient $client, CiRunData $presenter): JsonResponse
    {
        $this->authorize('run', [CiRunner::class, $site, $server]);
        $runner = $this->runner($site);
        $data = $request->validate([
            'ref' => ['required', 'string', 'max:200'],
            'stages' => ['required', 'array', 'min:1', 'max:20'],
            'stages.*' => ['required', 'string', 'distinct', Rule::in($client->info($runner)['stages'])],
        ]);
        $data['ref'] = $client->reference($data['ref']);
        $run = $client->request($runner, ['action' => 'run', ...$data]);
        $client->assertRun($runner, $run);

        return response()->json(['run' => $presenter->present($run)], 202)->header('Cache-Control', 'private, no-store');
    }

    #[Get('/{runId}/log', name: 'site-ci.log')]
    public function log(Request $request, Server $server, Site $site, string $runId, CiRunnerClient $client): JsonResponse
    {
        $this->authorize('viewAny', [CiRunner::class, $site, $server]);
        $runner = $this->runner($site);
        $this->verifyRun($client, $runner, $runId);
        $input = $request->validate(['cursor' => ['sometimes', 'integer', 'min:0', 'max:17825792'], 'stage' => ['nullable', 'string', Rule::in(['scaffold-check', ...$client->info($runner)['stages']])]]);
        $log = $client->request($runner, ['action' => 'log', 'run_id' => $runId, 'cursor' => (int) ($input['cursor'] ?? 0), 'stage' => $input['stage'] ?? null]);
        if (! is_string($log['text'] ?? null) || strlen($log['text']) > 131072 || ! is_int($log['cursor'] ?? null) || $log['cursor'] < (int) ($input['cursor'] ?? 0) || $log['cursor'] > 17825792) {
            throw ValidationException::withMessages(['ci' => __('The runner returned invalid log data.')]);
        }

        return response()->json(['text' => $log['text'], 'cursor' => $log['cursor']])->header('Cache-Control', 'private, no-store');
    }

    #[Post('/{runId}/cancel', name: 'site-ci.cancel')]
    public function cancel(Server $server, Site $site, string $runId, CiRunnerClient $client): JsonResponse
    {
        $this->authorize('run', [CiRunner::class, $site, $server]);
        $runner = $this->runner($site);
        $this->verifyRun($client, $runner, $runId);
        $result = $client->request($runner, ['action' => 'cancel', 'run_id' => $runId]);

        return response()->json(['cancel_requested' => ($result['cancel_requested'] ?? false) === true])->header('Cache-Control', 'private, no-store');
    }

    private function runner(Site $site): CiRunner
    {
        return CiRunner::query()->where('site_id', $site->id)->with(['site', 'server'])->firstOrFail();
    }

    private function verifyRun(CiRunnerClient $client, CiRunner $runner, string $runId): void
    {
        abort_unless(preg_match('/^[a-f0-9]{16}$/', $runId), 404);
        $client->assertRun($runner, $client->request($runner, ['action' => 'status', 'run_id' => $runId]));
    }
}
