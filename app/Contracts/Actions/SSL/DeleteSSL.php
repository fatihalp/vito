<?php

namespace App\Contracts\Actions\SSL;

use App\Models\Ssl;

interface DeleteSSL
{
    public function delete(Ssl $ssl): void;
}
