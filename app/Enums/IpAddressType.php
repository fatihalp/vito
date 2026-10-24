<?php

namespace App\Enums;

use App\Enums\Concerns\TextIsValue;
use App\Contracts\VitoEnum;
use Forjed\InertiaTable\Contracts\HasTableDisplay;

enum IpAddressType: string implements HasTableDisplay, VitoEnum
{
    use TextIsValue;

    case PUBLIC = 'public';
    case PRIVATE = 'private';
    case UNKNOWN = 'unknown';

    public function getColor(): string
    {
        return match ($this) {
            self::PUBLIC => 'info',
            self::PRIVATE => 'warning',
            self::UNKNOWN => 'gray',
        };
    }
}
