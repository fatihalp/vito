<?php

namespace App\Actions\RuntimeProcess;

use App\Enums\RuntimeProcessStatus;
use App\Jobs\RuntimeProcess\ControlRuntimeProcessJob;
use App\Models\RuntimeProcess;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class QueueRuntimeProcessControl
{
    public function queue(User $user, RuntimeProcess $process, string $operation): void
    {
        Validator::make(
            ['operation' => $operation],
            ['operation' => ['required', Rule::in(['start', 'stop', 'restart'])]],
        )->validate();

        if ($process->status === RuntimeProcessStatus::MASKED) {
            throw ValidationException::withMessages([
                'runtime' => 'This process is masked. Review its isolation before starting it.',
            ]);
        }

        $process->update([
            'details' => [
                ...($process->details ?? []),
                'command_result' => 'Command queued. Waiting for verification.',
            ],
        ]);
        ControlRuntimeProcessJob::dispatch($process, $operation, $user);
    }
}
