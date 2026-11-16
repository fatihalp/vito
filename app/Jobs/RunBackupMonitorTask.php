<?php

namespace App\Jobs;

use App\Actions\BackupMonitor\RequestBackupMonitorTask;
use App\Models\BackupMonitor;
use App\Models\User;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;
use Exception;
use App\Traits\UniqueQueue;

class RunBackupMonitorTask implements ShouldQueue, ShouldBeUnique
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
        $this->run('backup-monitor:'.$this->monitorId, fn () => $this->process($action));
    }

    private function process(RequestBackupMonitorTask $action): void
    {
        $monitor = BackupMonitor::query()->find($this->monitorId);
        $user = User::query()->find($this->userId);
        if (! $monitor) {
            return;
        }
        if (! $user) {
            $monitor->update(['task_state' => 'failed']);

            return;
        }
        try {
            $action->execute($user, $monitor, $this->task);
            RefreshBackupMonitor::dispatch($monitor->id)->delay(now()->addSeconds(15));
        } catch (Throwable) {
            $monitor->update(['task_state' => 'failed']);
            throw new \RuntimeException('The registered backup task could not be started.');
        }
    }

    public function failed(Exception $exception): void
    {
        $monitor = BackupMonitor::query()->find($this->monitorId);
        $monitor?->update(['task_state' => 'failed']);
    }
}
