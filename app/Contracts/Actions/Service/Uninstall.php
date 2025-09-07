<?php

namespace App\Contracts\Actions\Service;

use App\Models\Service;

interface Uninstall
{
    public function uninstall(Service $service): void;
}
