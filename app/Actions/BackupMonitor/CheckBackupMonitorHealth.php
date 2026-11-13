<?php

namespace App\Actions\BackupMonitor;

use App\Enums\BackupMonitorStatus;
use App\Models\BackupMonitor;
use App\Models\NotificationChannel;
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
        if (($healthy && $monitor->last_alert_status === null)
            || (! $healthy && $monitor->last_alert_status === $signature && $monitor->last_alert_requested_at?->isAfter(now()->subHours(max(1, (int) config('core.backup_alert_reminder_hours', 24)))))) {
            return;
        }
        $projectId = $monitor->server->project_id;
        $channels = NotificationChannel::query()->where('connected', true)
            ->where(fn ($query) => $query->whereNull('project_id')->when($projectId !== null, fn ($query) => $query->orWhere('project_id', $projectId)))->get();
        if ($channels->isEmpty()) {
            return;
        }
        $notification = new BackupMonitorStatusChanged($monitor, $healthy);
        $channels->each(fn (NotificationChannel $channel) => $channel->notify($notification));
        $monitor->update(['last_alert_status' => $signature, 'last_alert_requested_at' => now()]);
    }
}
