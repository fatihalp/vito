<?php

namespace App\Contracts\Actions\Service;

use App\Models\Service;

interface Manage
{
    public function start(Service $service): void;

    public function stop(Service $service): void;

    public function restart(Service $service): void;

    public function enable(Service $service): void;

    public function disable(Service $service): void;
}
