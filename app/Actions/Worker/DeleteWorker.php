<?php

namespace App\Actions\Worker;

use App\Contracts\Actions\Worker\DeleteWorker as DeleteWorkerContract;
use App\Models\Worker;

class DeleteWorker implements DeleteWorkerContract
{
    public function delete(Worker $worker): void
    {
        $worker->delete();
    }
}
