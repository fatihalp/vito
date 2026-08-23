<?php

namespace App\Facades;

use App\Models\Server;
use App\Models\ServerLog;
use App\Support\Testing\SSHFake;
use Illuminate\Contracts\View\View;
use Illuminate\Support\Facades\Facade as FacadeAlias;

class SSH extends FacadeAlias
{
    public static function fake(?string $output = null): SSHFake
    {
        static::swap($fake = new SSHFake($output));

        return $fake;
    }

    protected static function getFacadeAccessor(): string
    {
        return 'ssh';
    }
}
