<?php

namespace App\Contracts\Actions\Worker;

use App\Models\Worker;

interface EditWorker
{
    public function edit(Worker $worker, array $input): Worker;
}
