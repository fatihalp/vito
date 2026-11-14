<?php

namespace App\Actions\Service;

use App\Enums\ServiceStatus;
use App\Jobs\Service\ManageJob;
use App\Models\Service;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\DB;

class Manage
{
    public function start(Service $service): void
    {
        $this->dispatch($service, 'start', ServiceStatus::STARTING, ServiceStatus::READY);
    }

    public function stop(Service $service): void
    {
        $this->dispatch($service, 'stop', ServiceStatus::STOPPING, ServiceStatus::STOPPED);
    }

    public function restart(Service $service): void
    {
        $this->dispatch($service, 'restart', ServiceStatus::RESTARTING, ServiceStatus::READY);
    }

    public function reload(Service $service): void
    {
        $this->dispatch($service, 'reload', ServiceStatus::RELOADING, ServiceStatus::READY);
    }

    public function enable(Service $service): void
    {
        $this->dispatch($service, 'enable', ServiceStatus::ENABLING, ServiceStatus::READY);
    }

    public function disable(Service $service): void
    {
        $this->dispatch($service, 'disable', ServiceStatus::DISABLING, ServiceStatus::DISABLED);
    }

    private function dispatch(Service $service, string $action, ServiceStatus $pendingStatus, ServiceStatus $successStatus): void
    {
        DB::transaction(function () use ($service, $action, $pendingStatus, $successStatus): void {
            $lockedService = Service::query()->lockForUpdate()->findOrFail($service->id);
            $this->validate($lockedService);
            $lockedService->status = $pendingStatus;
            $lockedService->save();

            ManageJob::dispatch($lockedService, $action, $successStatus)->onQueue('ssh')->afterCommit();
        });
    }

    private function validate(Service $service): void
    {
        if (! $service->server->isReady() || ! in_array($service->status, [
            ServiceStatus::READY,
            ServiceStatus::STOPPED,
            ServiceStatus::DISABLED,
            ServiceStatus::FAILED,
        ], true)) {
            throw ValidationException::withMessages([
                'service' => 'The server is unavailable or another service operation is in progress. Wait for it to finish.',
            ]);
        }

        if (! $service->handler()->canBeManaged()) {
            throw ValidationException::withMessages([
                'service' => __('This service cannot be managed.'),
            ]);
        }
    }
}
