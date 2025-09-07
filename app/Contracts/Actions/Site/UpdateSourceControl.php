<?php

namespace App\Contracts\Actions\Site;

use App\Models\Site;

interface UpdateSourceControl
{
    public function update(Site $site, array $input): void;
}
