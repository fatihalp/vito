<?php

namespace App\Actions\SSL;

use App\Contracts\Actions\SSL\DeactivateSSL as DeactivateSSLContract;
use App\Models\Ssl;

class DeactivateSSL implements DeactivateSSLContract
{
    public function deactivate(Ssl $ssl): void
    {
        $ssl->is_active = false;
        $ssl->save();
        $ssl->site->webserver()->updateVHost($ssl->site, regenerate: [
            'port',
        ]);
    }
}
