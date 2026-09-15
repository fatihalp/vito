<?php

namespace App\Http\Controllers;

use App\Actions\Server\CreateServer;
use App\Actions\Server\DeleteServer;
use App\Actions\Server\ExecuteServerReboot;
use App\Actions\Server\GetAccessibleServers;
use App\Actions\Server\GetServers;
use App\Actions\Server\ProbeServerConnection;
use App\Actions\Server\RebootServer;
use App\Actions\Server\Security\CalculateSecurityScore;
use App\Actions\Server\StartServer;
use App\Actions\Server\StopServer;
use App\Actions\Server\TransferServer;
use App\Actions\Server\Update;
use App\Actions\Server\UpdateKernel;
use App\Enums\ServerStatus;
use App\Http\Resources\ServerLogResource;
use App\Http\Resources\ServerProviderResource;
use App\Http\Resources\ServerResource;
use App\Models\Server;
use App\Models\ServerProvider;
use App\Tables\ServerTable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Delete;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Patch;
use Spatie\RouteAttributes\Attributes\Post;
use Spatie\RouteAttributes\Attributes\Prefix;

#[Prefix('servers')]
#[Middleware(['auth', 'has-project'])]
class ServerController extends Controller
{

    #[Get('/', name: 'servers')]
    public function index(Request $request): Response
    {
        $this->authorize('viewAny', [Server::class]);

        $result = app(GetAccessibleServers::class)->get(user(), $request->input());

        $serverProviders = $result['scope'] === 'all'
            ? ServerProvider::query()->whereIn('project_id', user()->allProjects()->pluck('id'))->get()
            : ServerProvider::getByProjectId((int) $result['scope'], user())->get();

        return Inertia::render('servers/index', [
            'servers' => ServerTable::make($result['query'])
                ->withGrouping($result['groupBy'])
                ->withScope($result['scope'])
                ->simplePaginate(),
            'public_key' => __('servers.create.public_key_text', ['public_key' => get_public_key_content()]),
            'server_providers' => ServerProviderResource::collection($serverProviders),
            'serverScope' => $result['scope'],
            'groupBy' => $result['groupBy'],
        ]);
    }

    #[Get('/json', name: 'servers.json')]
    public function json(Request $request): ResourceCollection
    {
        $project = user()->currentProject;

        $this->authorize('viewAny', [Server::class, $project]);

        $servers = app(GetServers::class)->get($project, $request->input(), 10);

        return ServerResource::collection($servers);
    }

    #[Post('/', name: 'servers.store')]
    public function store(Request $request): RedirectResponse
    {
        $projectId = $request->input('project_id');
        $project = $projectId
            ? user()->allProjects()->where('projects.id', (int) $projectId)->firstOrFail()
            : user()->currentProject;

        $this->authorize('create', [Server::class, $project]);

        $server = app(CreateServer::class)->create(user(), $project, $request->all());

        return redirect()->route('servers.show', ['server' => $server->id]);
    }

    #[Get('/create', name: 'servers.create')]
    public function create(): Response
    {
        $project = user()->currentProject;

        $this->authorize('create', [Server::class, $project]);

        $serverProviders = ServerProvider::getByProjectId($project->id, user())->get();

        return Inertia::render('servers/create', [
            'public_key' => __('servers.create.public_key_text', ['public_key' => get_public_key_content()]),
            'server_providers' => ServerProviderResource::collection($serverProviders),
        ]);
    }

    #[Get('/{server}', name: 'servers.show')]
    public function show(Server $server): Response
    {
        $this->authorize('view', $server);

        return Inertia::render('servers/show', [
            'securityScore' => app(CalculateSecurityScore::class)->calculate($server),
            'logs' => $server->isInstalling()
                ? Inertia::defer(fn () => ServerLogResource::collection($server->logs()->latest()->simplePaginate(config('web.pagination_size'), pageName: 'logsPage')))
                : null,
        ]);
    }

    #[Post('/{server}/switch', name: 'servers.switch')]
    public function switch(Server $server): RedirectResponse
    {
        $this->authorize('view', $server);

        return redirect()->route('servers.show', ['server' => $server->id]);
    }

    #[Patch('/{server}/status', name: 'servers.status')]
    public function status(Server $server): RedirectResponse
    {
        $this->authorize('view', $server);

        $server->checkConnection();

        $server->refresh();

        return back()
            ->with($server->status->getColor(), __('Server status is :status', [
                'status' => $server->status->getText(),
            ]));
    }

    #[Get('/{server}/restart', name: 'servers.restart')]
    public function restart(Server $server): Response
    {
        $this->authorize('view', $server);

        return Inertia::render('servers/restart', [
            'server' => new ServerResource($server),
        ]);
    }

    #[Post('/{server}/restart/trigger', name: 'servers.restart.trigger')]
    public function triggerRestart(Server $server): JsonResponse
    {
        $this->authorize('reboot', $server);

        $result = app(ExecuteServerReboot::class)->run($server);

        return response()->json($result);
    }

    #[Post('/{server}/restart/probe', name: 'servers.restart.probe')]
    public function probe(Server $server): JsonResponse
    {
        $this->authorize('view', $server);

        $result = app(ProbeServerConnection::class)->probe($server);

        return response()->json($result);
    }

    #[Post('/{server}/reboot', name: 'servers.reboot')]
    public function reboot(Server $server): RedirectResponse
    {
        $this->authorize('reboot', $server);

        return redirect()->route('servers.restart', ['server' => $server->id, 'start' => 1]);
    }

    #[Post('/{server}/stop', name: 'servers.stop')]
    public function stop(Server $server): RedirectResponse
    {
        $this->authorize('update', $server);

        app(StopServer::class)->stop($server);

        return back()->with('success', 'Server stop command sent to '.$server->provider.'.');
    }

    #[Post('/{server}/start', name: 'servers.start')]
    public function start(Server $server): RedirectResponse
    {
        $this->authorize('start', $server);

        app(StartServer::class)->start($server);

        return back()->with('success', 'Server start command sent to '.$server->provider.'.');
    }

    

    #[Post('/{server}/check-for-updates', name: 'servers.check-for-updates')]
    public function checkForUpdates(Server $server): RedirectResponse
    {
        $this->authorize('update', $server);

        $server->checkForUpdates();

        $server->refresh();

        $message = "Available updates: {$server->updates}";

        if ($server->kernel_updates > 0) {
            $message .= " (plus {$server->kernel_updates} kernel)";
        }

        return back()->with('info', $message);
    }

    #[Get('/{server}/update', name: 'servers.update')]
    public function update(Server $server): Response
    {
        $this->authorize('view', $server);

        $latestLog = $server->logs()
            ->whereIn('type', ['upgrade', 'upgrade-kernel'])
            ->latest('id')
            ->first();

        return Inertia::render('servers/update', [
            'server' => new ServerResource($server),
            'initialLog' => $latestLog ? new ServerLogResource($latestLog) : null,
        ]);
    }

    #[Post('/{server}/update/trigger', name: 'servers.update.trigger')]
    public function triggerUpdate(Server $server, Request $request): JsonResponse
    {
        $this->authorize('update', $server);

        if ($server->status === ServerStatus::UPDATING) {
            $latestLog = $server->logs()
                ->whereIn('type', ['upgrade', 'upgrade-kernel'])
                ->latest('id')
                ->first();

            return response()->json([
                'success' => true,
                'already_running' => true,
                'log' => $latestLog ? new ServerLogResource($latestLog) : null,
            ]);
        }

        $type = $request->input('type', 'os');

        if ($type === 'kernel') {
            $log = app(UpdateKernel::class)->updateKernel($server);
        } else {
            $log = app(Update::class)->update($server);
        }

        return response()->json([
            'success' => true,
            'log' => new ServerLogResource($log),
        ]);
    }

    #[Post('/{server}/update', name: 'servers.update.post')]
    public function postUpdate(Server $server): RedirectResponse
    {
        $this->authorize('update', $server);

        return redirect()->route('servers.update', ['server' => $server->id, 'start' => 1]);
    }

    #[Post('/{server}/update-kernel', name: 'servers.update-kernel')]
    public function updateKernel(Server $server): RedirectResponse
    {
        $this->authorize('update', $server);

        return redirect()->route('servers.update', ['server' => $server->id, 'type' => 'kernel', 'start' => 1]);
    }

    #[Post('/{server}/transfer', name: 'servers.transfer')]
    public function transfer(Server $server, Request $request): RedirectResponse
    {
        $this->authorize('delete', $server);

        $server = app(TransferServer::class)->transfer(user(), $server, $request->all());

        user()->update(['current_project_id' => $server->project_id]);

        return redirect()->route('server-settings', ['server' => $server->id])
            ->with('success', __('Server transferred successfully.'));
    }

    #[Delete('/{server}', name: 'servers.destroy')]
    public function destroy(Server $server, Request $request): RedirectResponse
    {
        $this->authorize('delete', $server);

        app(DeleteServer::class)->delete($server, $request->all());

        return redirect()->route('servers')
            ->with('success', __('Server deleted successfully.'));
    }
}
