<?php

namespace App\Facades;

use App\Support\Testing\FTPFake;
use FTP\Connection;
use Illuminate\Support\Facades\Facade;


class FTP extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return 'ftp';
    }

    public static function fake(): FTPFake
    {
        static::swap($fake = new FTPFake);

        return $fake;
    }
}
