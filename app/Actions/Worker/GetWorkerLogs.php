<?php

namespace App\Actions\Worker;

use App\Models\Worker;
use Illuminate\Validation\ValidationException;

class GetWorkerLogs
{
    public function getLogs(Worker $worker, int $lines = 100): string
    {
        if (! $worker->server->isReady()) {
            throw ValidationException::withMessages(['server' => 'Live worker logs are unavailable while the server is offline.']);
        }

        $service = $worker->server->processManager();

        $handler = $service->handler();

        return $handler->getLogs($worker->user, $worker->getLogFile(), $lines);
    }

    public function clear(Worker $worker): void
    {
        $service = $worker->server->processManager();

        $handler = $service->handler();

        $handler->clearLogs($worker->user, $worker->getLogFile());
    }
}
