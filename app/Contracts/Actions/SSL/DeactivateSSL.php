<?php

namespace App\Contracts\Actions\SSL;

use App\Models\Ssl;

interface DeactivateSSL
{
    public function deactivate(Ssl $ssl): void;
}
