<?php

namespace App\Actions\Worker;

use App\Models\Worker;

class GetWorkerLogs
{
    public function getLogs(Worker $worker, int $lines = 100): string
    {
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
