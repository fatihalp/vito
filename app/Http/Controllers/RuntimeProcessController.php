<?php

namespace App\Http\Controllers;

use App\Actions\RuntimeProcess\ListRuntimeProcesses;
use App\Actions\RuntimeProcess\QueueRuntimeProcessControl;
use App\Actions\RuntimeProcess\RegisterRuntimeProcess;
use App\Jobs\RuntimeProcess\RefreshRuntimeProcessesJob;
use App\Models\RuntimeProcess;
use App\Models\Server;
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

#[Prefix('servers/{server}/runtime-processes')]
#[Middleware(['auth'])]
class RuntimeProcessController extends Controller
{
    #[Get('/', name: 'runtime-processes')]
    public function index(Server $server): Response
    {
        $this->authorize('viewAny', [RuntimeProcess::class, $server]);

        return Inertia::render('runtime-processes/index');
    }

    #[Get('/data', name: 'runtime-processes.data')]
    public function data(Request $request, Server $server, ListRuntimeProcesses $action): JsonResponse
    {
        $this->authorize('viewAny', [RuntimeProcess::class, $server]);

        return response()
            ->json($action->list($server, $request->all()))
            ->header('Cache-Control', 'no-store, private');
    }

    #[Post('/', name: 'runtime-processes.store')]
    public function store(Request $request, Server $server, RegisterRuntimeProcess $action): RedirectResponse
    {
        $this->authorize('create', [RuntimeProcess::class, $server]);
        $action->register($server, $request->all());
        RefreshRuntimeProcessesJob::dispatch($server);

        return back()->with('success', 'Existing process registered. Its status will be checked shortly.');
    }

    #[Post('/refresh', name: 'runtime-processes.refresh')]
    public function refresh(Server $server): RedirectResponse
    {
        $this->authorize('create', [RuntimeProcess::class, $server]);
        RefreshRuntimeProcessesJob::dispatch($server);

        return back()->with('success', 'Process status refresh queued.');
    }

    #[Post('/{runtimeProcess}/{operation}', name: 'runtime-processes.control')]
    public function control(
        Request $request,
        Server $server,
        RuntimeProcess $runtimeProcess,
        string $operation,
        QueueRuntimeProcessControl $action,
    ): RedirectResponse {
        $this->authorize('manage', [$runtimeProcess, $server]);
        $action->queue($request->user(), $runtimeProcess, $operation);

        return back()->with('success', 'Process command queued. Its result will appear here shortly.');
    }

    #[Delete('/{runtimeProcess}', name: 'runtime-processes.destroy')]
    public function destroy(Server $server, RuntimeProcess $runtimeProcess): RedirectResponse
    {
        $this->authorize('manage', [$runtimeProcess, $server]);
        $runtimeProcess->delete();

        return back()->with('success', 'Process unlinked. The running service was not changed.');
    }
}
