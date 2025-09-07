<?php

namespace App\Contracts\Actions\Site;

use App\Models\Deployment;
use App\Models\Site;

interface Deploy
{
    public function run(Site $site, bool $modern = true): Deployment;
}
