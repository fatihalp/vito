<?php

namespace App\Jobs\RuntimeProcess;

use App\Actions\RuntimeProcess\ControlRuntimeProcess;
use App\Models\RuntimeProcess;
use App\Models\User;
use Illuminate\Support\Facades\Gate;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class ControlRuntimeProcessJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;
    public int $timeout = 120;

    public function __construct(public RuntimeProcess $process, public string $operation, public User $requestedBy)
    {
        $this->onQueue('ssh');
    }

    public function handle(ControlRuntimeProcess $action): void
    {
        Gate::forUser($this->requestedBy)->authorize('manage', [$this->process, $this->process->server]);
        $action->control($this->process, $this->operation);
        $this->process->refresh()->update(['details' => [
            ...($this->process->details ?? []),
            'command_result' => 'The '.$this->operation.' command completed. Check the current status.',
        ]]);
    }

    public function failed(?Throwable $exception): void
    {
        $this->process->refresh()->update(['details' => [
            ...($this->process->details ?? []),
            'command_result' => 'The process command could not be confirmed. Check its status before retrying.',
        ]]);
    }
}
