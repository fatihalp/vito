<?php

namespace App\Http\Controllers;

use App\Actions\RuntimeProcess\RegisterRuntimeProcess;
use App\Enums\RuntimeProcessStatus;
use App\Http\Resources\RuntimeProcessResource;
use App\Jobs\RuntimeProcess\ControlRuntimeProcessJob;
use App\Jobs\RuntimeProcess\RefreshRuntimeProcessesJob;
use App\Models\RuntimeProcess;
use App\Models\Server;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
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
    public function data(Request $request, Server $server): JsonResponse
    {
        $this->authorize('viewAny', [RuntimeProcess::class, $server]);
        $filters = $request->validate(['site_id' => ['nullable', 'integer'], 'kind' => ['nullable', 'in:worker,scheduler,service']]);
        $query = RuntimeProcess::query()->where('server_id', $server->id)->with('sites:id,domain');
        if (! empty($filters['site_id'])) {
            $query->whereHas('sites', fn ($sites) => $sites->where('sites.id', $filters['site_id']));
        }
        if (! empty($filters['kind'])) {
            $query->where('kind', $filters['kind']);
        }

        $canManage = Gate::allows('create', [RuntimeProcess::class, $server]);

        return response()->json([
            'processes' => RuntimeProcessResource::collection($query->orderBy('kind')->orderBy('label')->limit(500)->get()),
            'sites' => $server->sites()->orderBy('domain')->get(['id', 'domain']),
            'can_manage' => $canManage,
            'isolated_users' => $canManage ? $server->isolatedUsers()->orderBy('username')->pluck('username') : [],
        ])->header('Cache-Control', 'no-store, private');
    }

    #[Post('/', name: 'runtime-processes.store')]
    public function store(Request $request, Server $server, RegisterRuntimeProcess $action): RedirectResponse
    {
        $this->authorize('create', [RuntimeProcess::class, $server]);
        $action->register($server, $request->all());
        RefreshRuntimeProcessesJob::dispatch($server);

        return back()->with('success', __('Existing process registered. Its status will be checked shortly.'));
    }

    #[Post('/refresh', name: 'runtime-processes.refresh')]
    public function refresh(Server $server): RedirectResponse
    {
        $this->authorize('create', [RuntimeProcess::class, $server]);
        RefreshRuntimeProcessesJob::dispatch($server);

        return back()->with('success', __('Process status refresh queued.'));
    }

    #[Post('/{runtimeProcess}/{operation}', name: 'runtime-processes.control')]
    public function control(Request $request, Server $server, RuntimeProcess $runtimeProcess, string $operation): RedirectResponse
    {
        $this->authorize('manage', [$runtimeProcess, $server]);
        Validator::make(['operation' => $operation], ['operation' => ['required', Rule::in(['start', 'stop', 'restart'])]])->validate();
        if ($runtimeProcess->status === RuntimeProcessStatus::MASKED) {
            throw ValidationException::withMessages(['runtime' => __('This process is masked. Review its isolation before starting it.')]);
        }
        $runtimeProcess->update(['details' => [...($runtimeProcess->details ?? []), 'command_result' => 'Command queued. Waiting for verification.']]);
        ControlRuntimeProcessJob::dispatch($runtimeProcess, $operation, $request->user());

        return back()->with('success', __('Process command queued. Its result will appear here shortly.'));
    }

    #[Delete('/{runtimeProcess}', name: 'runtime-processes.destroy')]
    public function destroy(Server $server, RuntimeProcess $runtimeProcess): RedirectResponse
    {
        $this->authorize('manage', [$runtimeProcess, $server]);
        $runtimeProcess->delete();

        return back()->with('success', __('Process unlinked. The running service was not changed.'));
    }
}
