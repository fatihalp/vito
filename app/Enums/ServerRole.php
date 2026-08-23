<?php

namespace App\Enums;

use App\Contracts\VitoEnum;
use Forjed\InertiaTable\Contracts\HasTableDisplay;

enum ServerRole: string implements HasTableDisplay, VitoEnum
{
    case APP = 'app';
    case QUEUE = 'queue';
    case DATABASE = 'database';
    case CACHE = 'cache';

    public function getColor(): string
    {
        return match ($this) {
            self::APP => 'info',
            self::QUEUE => 'warning',
            self::DATABASE => 'success',
            self::CACHE => 'default',
        };
    }

    public function getText(): string
    {
        return match ($this) {
            self::APP => 'App server',
            self::QUEUE => 'Queue server',
            self::DATABASE => 'Database server',
            self::CACHE => 'Cache (Redis) server',
        };
    }

    public function requiredServiceTypes(): array
    {
        return match ($this) {
            self::APP => ['webserver'],
            self::QUEUE => ['php', 'process_manager'],
            self::DATABASE => ['database'],
            self::CACHE => ['memory_database'],
        };
    }
}
