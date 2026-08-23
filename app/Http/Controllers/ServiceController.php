<?php

namespace App\Http\Controllers;

use App\Actions\Service\GetConfigFile;
use App\Actions\Service\GetNetworking;
use App\Actions\Service\Install;
use App\Actions\Service\Manage;
use App\Actions\Service\ManageNetworkingSecret;
use App\Actions\Service\RefreshServices;
use App\Actions\Service\ToggleNetworking;
use App\Actions\Service\Uninstall;
use App\Actions\Service\UpdateConfigFile;
use App\Models\Server;
use App\Models\Service;
use App\Tables\ServiceTable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Delete;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Patch;
use Spatie\RouteAttributes\Attributes\Post;
use Spatie\RouteAttributes\Attributes\Prefix;

#[Prefix('servers/{server}/services')]
#[Middleware(['auth', 'has-project'])]
class ServiceController extends Controller
{

    #[Get('/', name: 'services')]
    public function index(Server $server): Response
    {
        $this->authorize('viewAny', [Service::class, $server]);

        return Inertia::render('services/index', [
            'services' => ServiceTable::make($server->services())->simplePaginate(),
            'refreshing' => RefreshServices::refreshing($server),
        ]);
    }

    #[Get('{service}/versions', name: 'services.versions')]
    public function versions(Server $server, string $service): JsonResponse
    {
        $this->authorize('viewAny', [Service::class, $server]);

        return response()->json(
            $server->services()->where('type', $service)->latest('version')->pluck('version')
        );
    }

    #[Get('/live-statuses', name: 'services.live-statuses')]
    public function liveStatuses(Server $server): JsonResponse
    {
        $this->authorize('viewAny', [Service::class, $server]);

        $services = $server->services()->whereIn('status', ['ready', 'stopped', 'failed', 'disabled'])->get();

        $result = [];
        $checkable = [];
        $units = [];

        foreach ($services as $service) {
            if (! $service->hasHandler()) {
                continue;
            }
            $unit = $service->handler()->unit();
            if ($unit === '') {
                continue;
            }
            $checkable[] = $service;
            $units[] = $unit;
        }

        if ($units !== []) {
            $states = $server->systemd()->activeStates($units);
            foreach ($checkable as $index => $service) {
                $state = $states[$index] ?? 'unknown';
                $result[$service->id] = [
                    'state' => $state,
                    'color' => match ($state) {
                        'active' => 'success',
                        'inactive', 'failed' => 'danger',
                        'activating', 'deactivating', 'reloading' => 'warning',
                        default => 'gray',
                    },
                ];
            }
        }

        return response()->json($result);
    }

    #[Post('/', name: 'services.store')]
    public function store(Request $request, Server $server): RedirectResponse
    {
        $this->authorize('create', [Service::class, $server]);

        app(Install::class)->install($server, $request->input());

        return back()->with('success', __(':service is being installed.', [
            'service' => $request->input('name'),
        ]));
    }

    public function manage(Request $request, Server $server, Service $service): RedirectResponse
    {
        $action = $request->input('action');
        abort_unless(in_array($action, ['start', 'stop', 'restart', 'reload', 'enable', 'disable']), 404);
        $this->authorize($action, $service);

        app(Manage::class)->$action($service);

        return back()->with('success', __(":service is being {$action}ed.", [
            'service' => $service->name,
        ]));
    }

    #[Post('/refresh', name: 'services.refresh')]
    public function refresh(Server $server): RedirectResponse
    {
        $this->authorize('refresh', [Service::class, $server]);

        return back()->with('info', app(RefreshServices::class)->refresh($server)
            ? __('Refreshing services…')
            : __('A services refresh is already running.'));
    }

    #[Get('/{service}/networking', name: 'services.networking')]
    public function networking(Server $server, Service $service): JsonResponse
    {
        $this->authorize('manageNetworking', $service);

        return response()->json(app(GetNetworking::class)->get($service));
    }

    #[Post('/{service}/networking/enable', name: 'services.networking.enable')]
    public function enableNetworking(Server $server, Service $service): HttpResponse
    {
        $this->authorize('manageNetworking', $service);

        app(ToggleNetworking::class)->enable($service);

        return response()->noContent();
    }

    #[Post('/{service}/networking/disable', name: 'services.networking.disable')]
    public function disableNetworking(Server $server, Service $service): HttpResponse
    {
        $this->authorize('manageNetworking', $service);

        app(ToggleNetworking::class)->disable($service);

        return response()->noContent();
    }

    #[Post('/{service}/networking/secret', name: 'services.networking.secret.regenerate')]
    public function regenerateNetworkingSecret(Server $server, Service $service): HttpResponse
    {
        $this->authorize('manageNetworking', $service);

        app(ManageNetworkingSecret::class)->regenerate($service);

        return response()->noContent();
    }

    #[Delete('/{service}/networking/secret', name: 'services.networking.secret.destroy')]
    public function removeNetworkingSecret(Server $server, Service $service): HttpResponse
    {
        $this->authorize('manageNetworking', $service);

        app(ManageNetworkingSecret::class)->remove($service);

        return response()->noContent();
    }

    #[Delete('/{service}', name: 'services.destroy')]
    public function destroy(Server $server, Service $service): RedirectResponse
    {
        $this->authorize('delete', $service);

        app(Uninstall::class)->uninstall($service);

        return back()->with('warning', __(':service is being uninstalled.', [
            'service' => $service->name,
        ]));
    }

    #[Get('/{service}/config', name: 'services.config')]
    public function getConfig(Request $request, Server $server, Service $service): JsonResponse
    {
        $this->authorize('view', $service);

        $content = app(GetConfigFile::class)->get($service, $request->input());

        return response()->json([
            'content' => $content,
        ]);
    }

    #[Patch('/{service}/config', name: 'services.config.update')]
    public function updateConfig(Request $request, Server $server, Service $service): RedirectResponse
    {
        $this->authorize('update', $service);

        app(UpdateConfigFile::class)->update($service, $request->input());

        return back()->with('success', __('Config file updated successfully.'));
    }
}
