<?php

namespace App\Actions\RuntimeProcess;

use App\Enums\RuntimeProcessStatus;
use App\Models\RuntimeProcess;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ControlRuntimeProcess
{
    public function control(RuntimeProcess $process, string $operation): void
    {
        Validator::make(['operation' => $operation, 'name' => $process->runtime_name, 'driver' => $process->driver], [
            'operation' => ['required', Rule::in(['start', 'stop', 'restart'])],
            'name' => ['required', 'string', 'max:128', 'regex:/^[A-Za-z0-9][A-Za-z0-9_.@:-]*$/', Rule::notIn($process->driver === 'supervisor' ? ['all'] : [])],
            'driver' => ['required', Rule::in(['systemd', 'docker', 'supervisor'])],
        ])->validate();

        if ($process->status === RuntimeProcessStatus::MASKED) {
            throw ValidationException::withMessages(['runtime' => __('This process is masked. Its isolation must be reviewed before starting it.')]);
        }

        $command = match ($process->driver) {
            'systemd' => 'systemctl',
            'docker' => 'docker',
            'supervisor' => 'supervisorctl',
        };
        $process->server->ssh()->clearLog()->exec('sudo -n '.$command.' '.$operation.' '.escapeshellarg($process->runtime_name));
        app(RefreshRuntimeProcesses::class)->refresh($process->server);
    }
}
