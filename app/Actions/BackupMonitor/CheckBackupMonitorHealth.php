<?php

namespace App\Actions\BackupMonitor;

use App\Enums\BackupMonitorStatus;
use App\Facades\Notifier;
use App\Models\BackupMonitor;
use App\Notifications\BackupMonitorStatusChanged;

class CheckBackupMonitorHealth
{
    public function check(BackupMonitor $monitor): void
    {
        $monitor->refresh();

        if ($monitor->status === BackupMonitorStatus::RUNNING || ! $this->shouldAlert($monitor)) {
            return;
        }

        Notifier::send($monitor->server, new BackupMonitorStatusChanged($monitor, $monitor->isHealthy()));
        $monitor->update([
            'last_alert_status' => $monitor->alertSignature(),
            'last_alert_requested_at' => now(),
        ]);
    }

    private function shouldAlert(BackupMonitor $monitor): bool
    {
        if ($monitor->alertSignature() !== $monitor->last_alert_status) {
            return true;
        }

        return ! $monitor->isHealthy() && $monitor->isReminderDue();
    }
}
