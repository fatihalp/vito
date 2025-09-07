<?php

namespace App\Contracts\Actions\Site;

use App\Models\Command;
use App\Models\Site;

interface CreateCommand
{
    public function create(Site $site, array $input): Command;
}
