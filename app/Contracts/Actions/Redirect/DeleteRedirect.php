<?php

namespace App\Contracts\Actions\Redirect;

use App\Models\Redirect;
use App\Models\Site;

interface DeleteRedirect
{
    public function delete(Site $site, Redirect $redirect): void;
}
