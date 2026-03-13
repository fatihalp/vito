<?php

namespace App\Actions\Service;

use App\Enums\ServiceStatus;
use App\Jobs\Service\UninstallJob;
use App\Models\Service;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class Uninstall
{
    /*
     * @TODO: Implement the uninstaller for all service handlers
     */
    public function uninstall(Service $service): void
    {
        if ($service->is_vito_service) {
            throw ValidationException::withMessages([
                'service' => __('Cannot uninstall :service as it is required by Vito.', ['service' => $service->name]),
            ]);
        }

        Validator::make([
            'service' => $service->id,
        ], $service->handler()->deletionRules())->validate();

        $previousStatus = $service->status;

        $service->status = ServiceStatus::UNINSTALLING;
        $service->save();

        dispatch(new UninstallJob($service, $previousStatus))->onQueue('ssh');
    }
}
