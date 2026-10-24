<?php

namespace App\Enums;

use App\Enums\Concerns\TextIsValue;
use App\Contracts\VitoEnum;

enum ServerNetworkRuleKind: string implements VitoEnum
{
    use TextIsValue;

    case HANDSHAKE = 'handshake';
    case RULE = 'rule';

    public function getColor(): string
    {
        return match ($this) {
            self::HANDSHAKE => 'info',
            self::RULE => 'success',
        };
    }
}
