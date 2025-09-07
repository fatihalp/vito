<?php

namespace App\Contracts\Actions\Site;

use App\Models\Site;

interface UpdateLoadBalancer
{
    public function update(Site $site, array $input): void;
}
