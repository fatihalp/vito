<?php

namespace App\Actions\Worker;

use App\Enums\WorkerStatus;
use App\Jobs\Worker\DeleteJob;
use App\Models\Worker;
use Illuminate\Validation\ValidationException;

class DeleteWorker
{
    public function delete(Worker $worker): void
    {
        if ($worker->isSiteBootstrap()) {
            throw ValidationException::withMessages([
                'name' => __('This worker is managed by its site and cannot be deleted independently.'),
            ]);
        }

        $worker->status = WorkerStatus::DELETING;
        $worker->error = null;
        $worker->save();

        dispatch(new DeleteJob($worker))->onQueue('ssh');
    }
}
