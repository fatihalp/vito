<?php

namespace App\Jobs\Service;

use App\DTOs\SocketEventDTO;
use App\Enums\ServiceStatus;
use App\Events\SocketEvent;
use App\Http\Resources\ServiceResource;
use App\Models\ServerLog;
use App\Models\Service;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class UninstallJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public function __construct(protected Service $service, protected ServiceStatus $previousStatus) {}

    public function handle(): void
    {
        $succeeded = false;
        $this->run("server-{$this->service->server_id}", function () use (&$succeeded) {
            $projectId = $this->service->server->project_id;
            $serviceId = $this->service->id;
            $this->service->handler()->uninstall();
            $this->service->delete();

            SocketEvent::dispatch(new SocketEventDTO(
                projectId: $projectId,
                type: 'service.deleted',
                data: ['id' => $serviceId],
            ));
            $succeeded = true;
        });

        if ($succeeded) {
            UpdateVitoAgentConfigJob::dispatchFor($this->service);
        }
    }

    public function failed(Throwable $e): void
    {
        
        if ($this->previousStatus === ServiceStatus::FAILED) {
            $this->service->delete();

            return;
        }

        $this->service->status = ServiceStatus::FAILED;
        $this->service->save();
        $this->service->refresh();

        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $this->service->server->project_id,
            type: 'service.updated',
            data: new ServiceResource($this->service),
        ));

        ServerLog::log(
            $this->service->server,
            'service-uninstallation-failed',
            $e->getMessage()
        );
    }
}
