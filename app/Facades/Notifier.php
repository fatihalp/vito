<?php

namespace App\Facades;

use Illuminate\Support\Facades\Facade;

class Notifier extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return 'notifier';
    }
}
