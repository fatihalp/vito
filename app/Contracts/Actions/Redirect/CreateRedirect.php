<?php

namespace App\Contracts\Actions\Redirect;

use App\Models\Redirect;
use App\Models\Site;

interface CreateRedirect
{
    public function create(Site $site, array $input): Redirect;
}
