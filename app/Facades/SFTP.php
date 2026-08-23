<?php

namespace App\Facades;

use App\Support\Testing\SFTPFake;
use Illuminate\Support\Facades\Facade;

class SFTP extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return 'sftp';
    }

    public static function fake(): SFTPFake
    {
        static::swap($fake = new SFTPFake);

        return $fake;
    }
}
