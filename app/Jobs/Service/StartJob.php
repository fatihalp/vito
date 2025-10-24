<?php

namespace App\Jobs\Service;

use App\Enums\ServiceStatus;
use App\Models\Service;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class StartJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public function __construct(protected Service $service) {}

    public function handle(): void
    {
        $this->run("server-{$this->service->server_id}", function () {
            $status = $this->service->server->systemd()->start($this->service->handler()->unit());
            if (str($status)->contains('Active: active')) {
                $this->service->status = ServiceStatus::READY;
            } else {
                $this->service->status = ServiceStatus::FAILED;
            }
            $this->service->save();
        });
    }
}