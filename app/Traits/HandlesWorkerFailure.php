<?php

namespace App\Traits;

use App\Actions\Site\BroadcastSiteUpdate;
use App\DTOs\SocketEventDTO;
use App\Enums\WorkerLogType;
use App\Enums\WorkerStatus;
use App\Events\SocketEvent;
use App\Exceptions\SSHError;
use App\Http\Resources\WorkerResource;
use App\Models\ServerLog;
use App\Models\Site;
use App\Models\Worker;
use Throwable;

trait HandlesWorkerFailure
{
    private static array $benignSupervisorPhrases = ['already started', 'not running'];

    protected function markWorkerFailed(Worker $worker, Throwable $e, string $logType): void
    {
        $this->failWorker($worker, $this->extractError($e), $logType, $e->getMessage());
    }

    protected function failWorker(Worker $worker, ?string $error, string $logType, string $logMessage, WorkerStatus $status = WorkerStatus::FAILED): void
    {
        $worker->error = $error;
        $worker->status = $status;
        $worker->save();

        $worker->recordLog(WorkerLogType::FAILED, $error ? "Worker action failed: {$error}" : $logMessage, null);

        $this->broadcastWorkerUpdate($worker);

        ServerLog::log($worker->server, $logType, $logMessage);
    }

    protected function isBenignSupervisorStatus(string $status): bool
    {
        foreach (self::$benignSupervisorPhrases as $phrase) {
            if (str_contains($status, $phrase)) {
                return true;
            }
        }

        return false;
    }

    protected function broadcastWorkerUpdate(Worker $worker): void
    {
        $worker->refresh();

        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $worker->server->project_id,
            type: 'worker.updated',
            data: new WorkerResource($worker),
        ));
    }

    protected function broadcastSiteUpdate(?Site $site): void
    {
        if ($site) {
            app(BroadcastSiteUpdate::class)->broadcast($site);
        }
    }

    private function extractError(Throwable $e): ?string
    {
        $message = $e instanceof SSHError
            ? ($this->extractSshLogError($e) ?? trim($e->getMessage()))
            : trim($e->getMessage());

        if ($message === '') {
            return null;
        }

        return mb_substr($message, 0, 500);
    }

    private function extractSshLogError(SSHError $e): ?string
    {
        $log = $e->getLog();
        if ($log === null || $log->is_remote) {
            return null;
        }

        $content = $log->getContent(50);
        if (! is_string($content) || $content === '') {
            return null;
        }

        $allLines = collect(explode("\n", $content))
            ->map(fn (string $line): string => trim($line))
            ->filter(fn (string $line): bool => $line !== ''
                && $line !== 'VITO_SSH_ERROR'
                && $line !== 'SSH command failed with an error')
            ->values();

        $supervisorErrors = $allLines
            ->filter(fn (string $line): bool => str_contains($line, ': ERROR')
                && ! $this->isBenignSupervisorStatus($line))
            ->unique()
            ->values();

        if ($supervisorErrors->isNotEmpty()) {
            return $supervisorErrors->implode("\n");
        }

        $tail = $allLines->take(-5)->unique()->values();

        return $tail->isEmpty() ? null : $tail->implode("\n");
    }
}
