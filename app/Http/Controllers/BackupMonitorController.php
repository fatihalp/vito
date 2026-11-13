<?php

namespace App\Http\Controllers;

use App\Actions\BackupMonitor\ConfigureBackupMonitor;
use App\Actions\BackupMonitor\RequestBackupMonitorTask;
use App\Jobs\RefreshBackupMonitor;
use App\Models\BackupMonitor;
use App\Models\Server;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Spatie\RouteAttributes\Attributes\Delete;
use Spatie\RouteAttributes\Attributes\Middleware;
use Spatie\RouteAttributes\Attributes\Post;
use Spatie\RouteAttributes\Attributes\Prefix;

#[Prefix('servers/{server}/backup-monitors')]
#[Middleware(['auth', 'throttle:20,1'])]
class BackupMonitorController extends Controller
{
    #[Post('/', name: 'backup-monitors.store')]
    public function store(Request $request, Server $server, ConfigureBackupMonitor $action): RedirectResponse
    {
        $monitor = $action->configure($request->user(), $server, $request->all());
        RefreshBackupMonitor::dispatch($monitor->id);

        return back()->with('success', __('Backup monitoring connected.'));
    }

    #[Post('/{backupMonitor}/refresh', name: 'backup-monitors.refresh')]
    public function refresh(Server $server, BackupMonitor $backupMonitor): RedirectResponse
    {
        $this->authorize('view', [$backupMonitor, $server]);
        RefreshBackupMonitor::dispatch($backupMonitor->id);

        return back()->with('success', __('Backup report refresh queued.'));
    }

    #[Post('/{backupMonitor}/run', name: 'backup-monitors.run')]
    public function run(Request $request, Server $server, BackupMonitor $backupMonitor, RequestBackupMonitorTask $action): RedirectResponse
    {
        $this->authorize('run', [$backupMonitor, $server]);
        $action->request($request->user(), $backupMonitor, $request->all());

        return back()->with('success', __('Backup task requested. Its result will appear after the report is refreshed.'));
    }

    #[Delete('/{backupMonitor}', name: 'backup-monitors.destroy')]
    public function destroy(Server $server, BackupMonitor $backupMonitor): RedirectResponse
    {
        $this->authorize('delete', [$backupMonitor, $server]);
        $backupMonitor->delete();

        return back()->with('success', __('Monitoring removed. The backup repository and external schedules were preserved.'));
    }
}
