<?php

namespace App\Jobs\CronJob;

use App\DTOs\SocketEventDTO;
use App\Enums\CommandExecutionStatus;
use App\Events\SocketEvent;
use App\Http\Resources\CommandExecutionResource;
use App\Models\CommandExecution;
use App\Models\CronJob;
use App\Models\ServerLog;
use App\Traits\UniqueQueue;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class ExecuteCronJobJob implements ShouldQueue
{
    use Queueable;
    use UniqueQueue;

    public function __construct(
        protected CommandExecution $execution,
        protected CronJob $cronJob,
        protected ServerLog $log,
    ) {
        $this->onQueue('ssh');
    }

    public function handle(): void
    {
        $this->run("cronjob-{$this->cronJob->id}", function (): void {
            $site = $this->cronJob->site;
            $user = $this->cronJob->user ?: ($site?->user ?? $this->execution->server->getSshUser());
            $path = $site?->path ?? home_path($user);

            $script = (string) preg_replace(
                '/\s*>>?\s*\/dev\/null(?:\s+2>&1)?\s*$/',
                '',
                $this->execution->getContent()
            );

            $this->execution->server_log_id = $this->log->id;
            $this->execution->save();

            $this->execution->server->os()->runScript(
                path: $path,
                script: $script,
                serverLog: $this->log,
                user: $user,
                variables: $site ? array_merge(
                    $site->environmentVariables(),
                    $site->type()->deploymentEnvironment(),
                ) : [],
                aliases: $site ? $site->environmentAliases() : [],
            );

            $this->execution->status = CommandExecutionStatus::COMPLETED;
            $this->execution->save();
            $this->broadcastExecutionUpdate();
        });
    }

    public function failed(Throwable $e): void
    {
        $this->execution->status = CommandExecutionStatus::FAILED;
        $this->execution->save();
        $this->broadcastExecutionUpdate();
        ServerLog::log($this->execution->server, 'execute-cronjob-failed', $e->getMessage());
    }

    private function broadcastExecutionUpdate(): void
    {
        $this->execution->refresh();
        $this->execution->load('serverLog');

        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $this->execution->server->project_id,
            type: 'command-execution.updated',
            data: new CommandExecutionResource($this->execution),
        ));
    }
}
