<?php

namespace App\Contracts\Actions\Worker;

use App\Models\Worker;

interface ManageWorker
{
    public function start(Worker $worker): void;

    public function stop(Worker $worker): void;

    public function restart(Worker $worker): void;
}
