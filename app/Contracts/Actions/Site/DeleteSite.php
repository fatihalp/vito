<?php

namespace App\Contracts\Actions\Site;

use App\Models\Site;

interface DeleteSite
{
    public function delete(Site $site, array $input): void;
}
