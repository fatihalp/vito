<?php

namespace App\Actions\BackupMonitor;

use App\Models\BackupMonitor;
use App\Services\BackupMonitor\BackupReport;
use Illuminate\Validation\ValidationException;

class ReadBackupMonitor
{
    public function refresh(BackupMonitor $monitor): void
    {
        if (! $monitor->reportServer) {
            throw ValidationException::withMessages(['backup' => __('The backup report server is unavailable.')]);
        }
        $configuration = $monitor->configuration ?? [];
        $output = $monitor->reportServer->ssh()->clearLog()->exec(view('ssh.backups.read-monitor', ['path' => $configuration['report_path'] ?? '']), timeout: 20, outputLimit: 65536);
        $report = json_decode($output, true, 16, JSON_THROW_ON_ERROR);
        if (! is_array($report) || array_is_list($report)) {
            throw ValidationException::withMessages(['backup' => __('The backup report is invalid.')]);
        }
        $state = app(BackupReport::class)->parse($report, (int) ($configuration['max_age_hours'] ?? 36));
        BackupMonitor::query()->whereKey($monitor->id)
            ->where('report_server_id', $monitor->report_server_id)
            ->where('configuration', $monitor->getRawOriginal('configuration'))
            ->update(['status' => $state['status'], 'details' => json_encode($state['details'], JSON_THROW_ON_ERROR), 'last_checked_at' => now()]);
    }
}
