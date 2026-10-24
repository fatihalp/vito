<?php

namespace App\Enums;

use App\Enums\Concerns\TextIsValue;
use App\Contracts\VitoEnum;

enum SiteResourceStatus: string implements VitoEnum
{
    use TextIsValue;

    case CONNECTING = 'connecting';
    case READY = 'ready';
    case FAILED = 'failed';

    public function getColor(): string
    {
        return match ($this) {
            self::CONNECTING => 'warning',
            self::READY => 'success',
            self::FAILED => 'danger',
        };
    }
}
