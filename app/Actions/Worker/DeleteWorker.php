<?php

namespace App\Actions\Worker;

use App\Models\Worker;
use Illuminate\Validation\ValidationException;

class DeleteWorker
{
    
    public function delete(Worker $worker): void
    {
        if ($worker->isSiteBootstrap()) {
            throw ValidationException::withMessages([
                'name' => 'This worker is managed by its site. Delete the site to remove it.',
            ]);
        }

        $worker->delete();
    }
}
