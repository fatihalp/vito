<?php

namespace App\Facades;

use Illuminate\Support\Facades\Facade as FacadeAlias;

class SSH extends FacadeAlias
{
    protected static $cached = false;

    protected static function getFacadeAccessor(): string
    {
        return 'ssh';
    }
}

