<?php

namespace App\Contracts\Actions\ServerLog;

use App\Models\Server;

interface CreateLog
{
    public function create(Server $server, array $input): void;
}
