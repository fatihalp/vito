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

        if ($monitor->status === BackupMonitorStatus::RUNNING) {
            return;
        }

        $healthy = $monitor->status === BackupMonitorStatus::HEALTHY;
        $signature = $healthy ? null : $monitor->status->value.':'.($monitor->details['error_code'] ?? 'unverified');
        $reminderDue = $monitor->last_alert_requested_at?->lte(now()->subHours((int) config('core.backup_alert_reminder_hours'))) ?? true;

        if ($signature === $monitor->last_alert_status && ($healthy || ! $reminderDue)) {
            return;
        }

        Notifier::send($monitor->server, new BackupMonitorStatusChanged($monitor, $healthy));
        $monitor->update(['last_alert_status' => $signature, 'last_alert_requested_at' => now()]);
    }
}
