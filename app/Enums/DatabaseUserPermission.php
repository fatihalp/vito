<?php

namespace App\Enums;

use App\Enums\Concerns\TextIsValue;
use App\Contracts\VitoEnum;
use Forjed\InertiaTable\Contracts\HasTableDisplay;

enum DatabaseUserPermission: string implements HasTableDisplay, VitoEnum
{
    use TextIsValue;

    case READ = 'read';
    case WRITE = 'write';
    case ADMIN = 'admin';

    public function getColor(): string
    {
        return match ($this) {
            self::READ => 'default',
            self::WRITE => 'info',
            self::ADMIN => 'warning',
        };
    }
}
