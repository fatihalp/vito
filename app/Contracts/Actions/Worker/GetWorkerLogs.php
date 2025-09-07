<?php

namespace App\Contracts\Actions\Worker;

use App\Models\Worker;

interface GetWorkerLogs
{
    public function getLogs(Worker $worker): string;
}
