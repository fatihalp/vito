<?php

namespace App\Jobs\Redirect;

use App\DTOs\SocketEventDTO;
use App\Enums\RedirectStatus;
use App\Events\SocketEvent;
use App\Http\Resources\RedirectResource;
use App\Models\Redirect;
use App\Models\ServerLog;
use App\Models\Site;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class CreateJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public function __construct(protected Site $site, protected Redirect $redirect) {}

    public function handle(): void
    {
        $this->run("server-{$this->site->server_id}", function () {
            
            $service = $this->site->server->webserver();
            
            $webserver = $service->handler();
            $webserver->updateVHost($this->site);
            $this->redirect->status = RedirectStatus::READY;
            $this->redirect->save();
            $this->broadcastRedirectUpdate();
        });
    }

    public function failed(Throwable $e): void
    {
        $this->redirect->status = RedirectStatus::FAILED;
        $this->redirect->save();
        $this->broadcastRedirectUpdate();

        ServerLog::log(
            $this->site->server,
            'create-redirect-failed',
            $e->getMessage(),
            $this->site
        );
    }

    private function broadcastRedirectUpdate(): void
    {
        $this->redirect->refresh();

        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $this->site->server->project_id,
            type: 'redirect.updated',
            data: new RedirectResource($this->redirect),
        ));
    }
}
