<?php

namespace App\Contracts\Actions\Site;

use App\Models\Site;

interface UpdateEnv
{
    public function update(Site $site, array $input): void;
}
