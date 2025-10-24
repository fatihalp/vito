<?php

namespace App\Actions\Service;

use App\Enums\ServiceStatus;
use App\Jobs\Service\DisableJob;
use App\Jobs\Service\EnableJob;
use App\Jobs\Service\RestartJob;
use App\Jobs\Service\StartJob;
use App\Jobs\Service\StopJob;
use App\Models\Service;
use Illuminate\Validation\ValidationException;

class Manage
{
    public function start(Service $service): void
    {
        $this->validate($service);
        $service->status = ServiceStatus::STARTING;
        $service->save();
        dispatch(new StartJob($service))->onQueue('ssh');
    }

    public function stop(Service $service): void
    {
        $this->validate($service);
        $service->status = ServiceStatus::STOPPING;
        $service->save();
        dispatch(new StopJob($service))->onQueue('ssh');
    }

    public function restart(Service $service): void
    {
        $this->validate($service);
        $service->status = ServiceStatus::RESTARTING;
        $service->save();
        dispatch(new RestartJob($service))->onQueue('ssh');
    }

    public function enable(Service $service): void
    {
        $this->validate($service);
        $service->status = ServiceStatus::ENABLING;
        $service->save();
        dispatch(new EnableJob($service))->onQueue('ssh');
    }

    public function disable(Service $service): void
    {
        $this->validate($service);
        $service->status = ServiceStatus::DISABLING;
        $service->save();
        dispatch(new DisableJob($service))->onQueue('ssh');
    }

    private function validate(Service $service): void
    {
        if (! $service->handler()->unit()) {
            throw ValidationException::withMessages([
                'service' => __('This service does not have a systemd unit configured.'),
            ]);
        }
    }
}
