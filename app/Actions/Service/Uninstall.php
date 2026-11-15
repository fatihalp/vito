<?php

namespace App\Actions\Service;

use App\Enums\ServiceStatus;
use App\Jobs\Service\UninstallJob;
use App\Models\Service;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class Uninstall
{
    
    public function uninstall(Service $service): void
    {
        DB::transaction(function () use ($service): void {
            $service = Service::query()->lockForUpdate()->findOrFail($service->id);

            if (! $service->server->isReady() || ! in_array($service->status, [
                ServiceStatus::READY,
                ServiceStatus::STOPPED,
                ServiceStatus::DISABLED,
                ServiceStatus::FAILED,
                ServiceStatus::INSTALLATION_FAILED,
            ], true)) {
                throw ValidationException::withMessages([
                    'service' => 'The server is unavailable or another service operation is in progress. Wait for it to finish.',
                ]);
            }

            Validator::make([
                'service' => $service->id,
            ], $service->handler()->deletionRules())->validate();

            $previousStatus = $service->status;
            $service->status = ServiceStatus::UNINSTALLING;
            $service->save();

            UninstallJob::dispatch($service, $previousStatus)->onQueue('ssh')->afterCommit();
        });
    }
}
