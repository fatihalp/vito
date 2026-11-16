<?php

namespace App\Jobs;

use App\Actions\BackupMonitor\CheckBackupMonitorHealth;
use App\Actions\BackupMonitor\ReadBackupMonitor;
use App\Models\BackupMonitor;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class RefreshBackupMonitor implements ShouldBeUnique, ShouldQueue
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

    public function handle(ReadBackupMonitor $reader, CheckBackupMonitorHealth $health): void
    {
        $this->run('backup-monitor:'.$this->monitorId, function () use ($reader, $health): void {
            $monitor = BackupMonitor::query()->find($this->monitorId);

            if (! $monitor) {
                return;
            }

            try {
                $reader->refresh($monitor);
            } catch (Throwable $e) {
                $monitor->markReadFailed();
                throw $e;
            } finally {
                $health->check($monitor);
            }
        });
    }

    public function failed(Throwable $exception): void
    {
        BackupMonitor::query()->find($this->monitorId)?->markReadFailed();
    }
}
