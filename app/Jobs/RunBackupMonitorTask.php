<?php

namespace App\Jobs;

use App\Actions\BackupMonitor\RequestBackupMonitorTask;
use App\Models\BackupMonitor;
use App\Models\User;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class RunBackupMonitorTask implements ShouldBeUnique, ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public int $timeout = 25;

    public int $uniqueFor = 120;

    public function __construct(public int $monitorId, public int $userId, public string $task) {}

    public function uniqueId(): string
    {
        return $this->monitorId.':'.$this->task;
    }

    public function handle(RequestBackupMonitorTask $action): void
    {
        $this->run('backup-monitor:'.$this->monitorId, function () use ($action): void {
            $monitor = BackupMonitor::query()->findOrFail($this->monitorId);
            $action->execute(User::query()->findOrFail($this->userId), $monitor, $this->task);
            RefreshBackupMonitor::dispatch($monitor->id)->delay(now()->addSeconds(15));
        });
    }

    public function failed(Throwable $exception): void
    {
        BackupMonitor::query()->find($this->monitorId)?->update(['task_state' => 'failed']);
    }
}
