<?php

namespace App\Actions\BackupMonitor;

use App\Jobs\RunBackupMonitorTask;
use App\Models\BackupMonitor;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RequestBackupMonitorTask
{
    public function request(User $user, BackupMonitor $monitor, array $input): void
    {
        $task = Validator::make($input, ['task' => ['required', 'string', Rule::in(['backup', 'verify'])]])->validate()['task'];
        Gate::forUser($user)->authorize('run', [$monitor, $monitor->server]);
        $this->unit($monitor, $task);
        $monitor->update(['task_state' => 'requested', 'last_task' => $task, 'task_requested_at' => now()]);
        RunBackupMonitorTask::dispatch($monitor->id, $user->id, $task);
    }

    public function execute(User $user, BackupMonitor $monitor, string $task): void
    {
        Gate::forUser($user)->authorize('run', [$monitor, $monitor->server]);
        $unit = $this->unit($monitor, $task);
        $monitor->reportServer->ssh()->clearLog()->exec(view('ssh.backups.run-monitor-task', ['unit' => $unit]), timeout: 15, outputLimit: 4096);
        $monitor->update(['task_state' => 'submitted']);
    }

    private function unit(BackupMonitor $monitor, string $task): string
    {
        $unit = in_array($task, ['backup', 'verify'], true) ? ($monitor->configuration[$task.'_unit'] ?? null) : null;
        if (! $monitor->reportServer || ! is_string($unit) || ! preg_match('/\A[A-Za-z0-9][A-Za-z0-9_.@:-]{0,119}\.service\z/', $unit)) {
            throw ValidationException::withMessages(['task' => __('This backup task has not been configured by an administrator.')]);
        }

        return $unit;
    }
}
