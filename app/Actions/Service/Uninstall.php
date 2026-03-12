<?php

namespace App\Actions\Service;

use App\Enums\ServiceStatus;
use App\Jobs\Service\UninstallJob;
use App\Models\Service;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class Uninstall
{
    private const LOCAL_PROTECTED_SERVICES = ['nginx', 'redis', 'supervisor'];

    /*
     * @TODO: Implement the uninstaller for all service handlers
     */
    public function uninstall(Service $service): void
    {
        if ($service->server->isLocal() && $this->isProtectedService($service)) {
            throw ValidationException::withMessages([
                'service' => 'Cannot uninstall '.$service->name.' on the local server as it is required by Vito.',
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

    private function isProtectedService(Service $service): bool
    {
        if (in_array($service->name, self::LOCAL_PROTECTED_SERVICES)) {
            return true;
        }

        if ($service->type === 'php' && $service->version === '8.4') {
            return true;
        }

        return false;
    }
}
