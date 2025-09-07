<?php

namespace App\Contracts\Actions\Worker;

use App\Models\Worker;

interface DeleteWorker
{
    public function delete(Worker $worker): void;
}
