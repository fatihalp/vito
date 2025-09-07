<?php

namespace App\Contracts\Actions\SSL;

use App\Models\Ssl;

interface ActivateSSL
{
    public function activate(Ssl $ssl): void;
}
