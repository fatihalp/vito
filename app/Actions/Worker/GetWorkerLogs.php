<?php

namespace App\Actions\Worker;

use App\Models\Service;
use App\Models\Worker;
use App\Services\ProcessManager\ProcessManager;

class GetWorkerLogs
{
    public function getLogs(Worker $worker): string
    {
        
        $service = $worker->server->processManager();

        
        $handler = $service->handler();

        return $handler->getLogs($worker->user, $worker->getLogFile());
    }
}
