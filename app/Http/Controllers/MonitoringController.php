<?php

namespace App\Http\Controllers;

use App\Actions\Monitoring\GetMetrics;
use App\Actions\Monitoring\GetServerInformation;
use App\Actions\Monitoring\GetServerProcesses;
use App\Actions\Monitoring\GetLogRotationData;
use App\Actions\Monitoring\KillProcess;
use App\Actions\Monitoring\KillUserProcesses;
use App\Actions\Monitoring\UpdateMetricSettings;
use App\Actions\Server\ClearServiceLog;
use App\Enums\ServiceStatus;
use App\Models\Metric;
use App\Models\Server;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\RouteAttributes\Attributes\Delete;
use Spatie\RouteAttributes\Attributes\Get;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Patch;
use Spatie\RouteAttributes\Attributes\Post;
use Spatie\RouteAttributes\Attributes\Prefix;

#[Prefix('servers/{server}/monitoring')]
#[Middleware(['auth', 'has-project'])]
class MonitoringController extends Controller
{

    #[Get('/', name: 'monitoring')]
    public function index(Server $server): Response
    {
        $this->authorize('viewAny', [Metric::class, $server]);

        return Inertia::render('monitoring/index', [
            'dataRetention' => $server->monitoring()?->type_data['data_retention'] ?? 30,
            'hasMonitoringService' => $server->monitoring()?->status === ServiceStatus::READY,
        ]);
    }

    #[Get('/json', name: 'monitoring.json')]
    public function json(Request $request, Server $server): JsonResponse
    {
        $this->authorize('viewAny', [Metric::class, $server]);

        $metrics = app(GetMetrics::class)->filter($server, $request->input());

        return response()->json($metrics);
    }

    #[Get('/{metric}', name: 'monitoring.show')]
    public function show(Server $server, string $metric): Response
    {
        if (! in_array($metric, ['load', 'memory', 'disk'])) {
            abort(404);
        }

        $this->authorize('viewAny', [Metric::class, $server]);

        return Inertia::render('monitoring/show', [
            'metric' => $metric,
        ]);
    }

    #[Patch('/update', name: 'monitoring.update')]
    public function update(Request $request, Server $server): RedirectResponse
    {
        
        $monitoring = $server->monitoring();

        if (! $monitoring) {
            abort(404);
        }

        $this->authorize('update', $monitoring);

        app(UpdateMetricSettings::class)->update($server, $request->input());

        return back()->with('success', 'Settings updated!');
    }

    #[Delete('/reset', name: 'monitoring.destroy')]
    public function destroy(Server $server): RedirectResponse
    {
        
        $monitoring = $server->monitoring();

        if (! $monitoring) {
            abort(404);
        }

        $this->authorize('update', $monitoring);

        $server->metrics()->delete();

        return back()->with('success', 'All metrics deleted!');
    }

    #[Get('/processes', name: 'monitoring.processes')]
    public function processes(Server $server): Response
    {
        $this->authorize('viewAny', [Metric::class, $server]);

        $data = app(GetServerProcesses::class)->handle($server);

        return Inertia::render('monitoring/processes', [
            'processes' => $data['processes'] ?? [],
            'users' => $data['users'] ?? [],
            'error' => $data['error'] ?? null,
        ]);
    }

    #[Get('/processes/json', name: 'monitoring.processes.json')]
    public function processesJson(Server $server): JsonResponse
    {
        $this->authorize('viewAny', [Metric::class, $server]);

        $data = app(GetServerProcesses::class)->handle($server);

        return response()->json($data);
    }

    #[Post('/processes/kill', name: 'monitoring.processes.kill')]
    public function killProcess(Request $request, Server $server): RedirectResponse
    {
        $this->authorize('update', $server);

        $request->validate([
            'pid' => ['required', 'integer', 'min:2'],
        ]);

        $success = app(KillProcess::class)->handle($server, (int) $request->input('pid'));

        if (! $success) {
            return back()->with('error', 'Failed to terminate process #' . $request->input('pid'));
        }

        return back()->with('success', 'Process #' . $request->input('pid') . ' terminated successfully.');
    }

    #[Post('/processes/kill-user', name: 'monitoring.processes.kill-user')]
    public function killUserProcesses(Request $request, Server $server): RedirectResponse
    {
        $this->authorize('update', $server);

        $request->validate([
            'user' => ['required', 'string', 'max:64'],
        ]);

        $targetUser = $request->input('user');
        $success = app(KillUserProcesses::class)->handle($server, $targetUser);

        if (! $success) {
            return back()->with('error', 'Failed to terminate processes for user: ' . $targetUser);
        }

        return back()->with('success', 'All processes for user "' . $targetUser . '" terminated.');
    }

    #[Get('/information', name: 'monitoring.information')]
    public function information(Server $server): Response
    {
        $this->authorize('viewAny', [Metric::class, $server]);

        $info = app(GetServerInformation::class)->handle($server);

        return Inertia::render('monitoring/information', [
            'info' => $info,
        ]);
    }

    #[Get('/information/json', name: 'monitoring.information.json')]
    public function informationJson(Server $server): JsonResponse
    {
        $this->authorize('viewAny', [Metric::class, $server]);

        $info = app(GetServerInformation::class)->handle($server);

        return response()->json($info);
    }

    #[Get('/log-rotation', name: 'monitoring.log-rotation')]
    public function logRotation(Server $server): Response
    {
        $this->authorize('viewAny', [Metric::class, $server]);

        $logs = app(GetLogRotationData::class)->handle($server);

        return Inertia::render('monitoring/log-rotation', [
            'logs' => $logs,
        ]);
    }

    #[Post('/log-rotation/clear', name: 'monitoring.log-rotation.clear')]
    public function clearLog(Request $request, Server $server): RedirectResponse
    {
        $this->authorize('update', $server);

        app(ClearServiceLog::class)->run($server, $request->only('key'));

        return back()->with('success', 'Log file cleared successfully.');
    }
}
