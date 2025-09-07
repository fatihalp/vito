<?php

namespace App\Actions\SSL;

use App\Contracts\Actions\SSL\ActivateSSL as ActivateSSLContract;
use App\Models\Ssl;

class ActivateSSL implements ActivateSSLContract
{
    public function activate(Ssl $ssl): void
    {
        $ssl->site->ssls()->update(['is_active' => false]);
        $ssl->is_active = true;
        $ssl->save();
        $ssl->site->webserver()->updateVHost($ssl->site, regenerate: [
            'port',
        ]);
    }
}
