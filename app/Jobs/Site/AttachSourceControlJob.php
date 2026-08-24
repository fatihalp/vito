<?php

namespace App\Jobs\Site;

use App\DTOs\SocketEventDTO;
use App\Enums\SiteStatus;
use App\Events\SocketEvent;
use App\Exceptions\FailedToDeployGitKey;
use App\Exceptions\RepositoryNotFound;
use App\Exceptions\RepositoryPermissionDenied;
use App\Exceptions\SourceControlIsNotConnected;
use App\Exceptions\SSHCommandError;
use App\Exceptions\SSHConnectionError;
use App\Http\Resources\SiteResource;
use App\Models\ServerLog;
use App\Models\Site;
use App\Traits\UniqueQueue;
use Exception;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class AttachSourceControlJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public function __construct(protected Site $site)
    {
        $this->onQueue('ssh');
    }

    public function handle(): void
    {
        $this->run("server-{$this->site->server_id}", function () {
            $this->site->type()->attachSourceControl();
            $this->site->status = SiteStatus::READY;
            $this->site->last_error = null;
            $this->site->save();
            $this->broadcastSiteUpdate();
        });
    }

    public function failed(Exception $e): void
    {
        $this->site->source_control_id = null;
        $this->site->repository = null;
        $this->site->branch = null;
        $this->site->status = SiteStatus::READY;
        $this->site->last_error = $this->safeErrorSummary($e);
        $this->site->save();
        $this->broadcastSiteUpdate();
        ServerLog::log(
            $this->site->server,
            'site-attach-source-control-failed',
            $this->safeErrorSummary($e),
            $this->site
        );
    }

    private function safeErrorSummary(Exception $e): string
    {
        $messages = [
            SSHConnectionError::class => 'Could not connect to the server over SSH. Verify the server is reachable and try again.',
            RepositoryNotFound::class => 'Repository not found on the source control provider.',
            RepositoryPermissionDenied::class => 'Permission denied accessing the repository on the source control provider.',
            SourceControlIsNotConnected::class => 'Source control provider is not connected.',
        ];

        foreach ($messages as $class => $message) {
            if ($e instanceof $class) {
                return $message;
            }
        }

        if ($e instanceof FailedToDeployGitKey) {
            return 'Source control provider rejected the deploy key request.';
        }

        if ($e instanceof SSHCommandError) {
            return 'An SSH command failed while cloning the repository. Check the site logs for the failing command.';
        }

        return 'Attaching source control failed due to an unexpected error.';
    }

    private function broadcastSiteUpdate(): void
    {
        $this->site->refresh();

        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $this->site->server->project_id,
            type: 'site.updated',
            data: new SiteResource($this->site),
        ));
    }
}
