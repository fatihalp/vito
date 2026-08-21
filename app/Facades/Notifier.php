<?php

namespace App\Facades;

use App\Notifications\NotificationInterface;
use Illuminate\Support\Facades\Facade;


class Notifier extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return 'notifier';
    }
}
