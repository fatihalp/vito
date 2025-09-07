<?php

namespace App\Contracts\Actions\Server;

use App\Models\Server;

interface InstallServer
{
    public function run(Server $server): void;

    public function install(): void;
}
