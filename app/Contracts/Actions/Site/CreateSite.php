<?php

namespace App\Contracts\Actions\Site;

use App\Models\Server;
use App\Models\Site;

interface CreateSite
{
    public function create(Server $server, array $input): Site;
}
