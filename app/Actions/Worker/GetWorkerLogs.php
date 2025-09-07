<?php

namespace App\Actions\Worker;

use App\Contracts\Actions\Worker\GetWorkerLogs as GetWorkerLogsContract;
use App\Models\Service;
use App\Models\Worker;
use App\Services\ProcessManager\ProcessManager;

class GetWorkerLogs implements GetWorkerLogsContract
{
    public function getLogs(Worker $worker): string
    {
        /** @var Service $service */
        $service = $worker->server->processManager();

        /** @var ProcessManager $handler */
        $handler = $service->handler();

        return $handler->getLogs($worker->user, $worker->getLogFile());
    }
}
