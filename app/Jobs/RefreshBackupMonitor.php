<?php

namespace App\Jobs;

use App\Actions\BackupMonitor\ReadBackupMonitor;
use App\Actions\BackupMonitor\CheckBackupMonitorHealth;
use App\Models\BackupMonitor;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;
use Exception;
use App\Traits\UniqueQueue;

class RefreshBackupMonitor implements ShouldQueue, ShouldBeUnique
{
    use Queueable;
    use UniqueQueue;

    public int $timeout = 30;

    public int $uniqueFor = 120;

    public function __construct(public int $monitorId) {}

    public function uniqueId(): string
    {
        return (string) $this->monitorId;
    }

    public function handle(ReadBackupMonitor $action, CheckBackupMonitorHealth $health): void
    {
        $this->run('backup-monitor:'.$this->monitorId, fn () => $this->process($action, $health));
    }

    private function process(ReadBackupMonitor $action, CheckBackupMonitorHealth $health): void
    {
        $monitor = BackupMonitor::query()->find($this->monitorId);
        if (! $monitor) {
            return;
        }
        $failed = false;
        try {
            $action->refresh($monitor);
        } catch (Throwable) {
            $monitor->update(['status' => 'unknown', 'details' => [...($monitor->details ?? []), 'error_code' => 'read_failed'], 'last_checked_at' => now()]);
            $failed = true;
        }
        $health->check($monitor);
        if ($failed) {
            throw new \RuntimeException('Could not refresh the registered backup report.');
        }
    }

    public function failed(Exception $exception): void
    {
        $monitor = BackupMonitor::query()->find($this->monitorId);
        if ($monitor?->last_checked_at?->isAfter(now()->subMinute())) {
            return;
        }
        $monitor?->update(['status' => 'unknown', 'details' => ['error_code' => 'read_failed'], 'last_checked_at' => now()]);
    }
}
