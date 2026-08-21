<?php

namespace App\Enums;

use App\Contracts\VitoEnum;

enum SiteResourceStatus: string implements VitoEnum
{
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

    public function getText(): string
    {
        return $this->value;
    }
}
