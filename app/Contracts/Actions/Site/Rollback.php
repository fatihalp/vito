<?php

namespace App\Contracts\Actions\Site;

use App\Models\Deployment;

interface Rollback
{
    public function run(Deployment $deployment): void;
}
