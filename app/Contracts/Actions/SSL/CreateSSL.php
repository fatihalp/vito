<?php

namespace App\Contracts\Actions\SSL;

use App\Models\Site;
use App\Models\Ssl;

interface CreateSSL
{
    public function create(Site $site, array $input): Ssl;
}
