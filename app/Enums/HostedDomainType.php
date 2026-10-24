<?php

namespace App\Enums;

use App\Enums\Concerns\TextIsValue;
use App\Contracts\VitoEnum;
use App\Traits\HasEnumHelpers;

enum HostedDomainType: string implements VitoEnum
{
    use TextIsValue;

    use HasEnumHelpers;

    case PRIMARY = 'primary';
    case ALIAS = 'alias';
    case REDIRECT = 'redirect';

    public function getColor(): string
    {
        return match ($this) {
            self::PRIMARY => 'success',
            self::ALIAS => 'default',
            self::REDIRECT => 'warning',
        };
    }
}
