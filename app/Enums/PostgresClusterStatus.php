<?php

namespace App\Enums;

use App\Contracts\VitoEnum;

enum PostgresClusterStatus: string implements VitoEnum
{
    case ACTIVE = 'active';
    case FAILING_OVER = 'failing_over';

    public function getColor(): string
    {
        return match ($this) {
            self::ACTIVE => 'success',
            self::FAILING_OVER => 'warning',
        };
    }

    public function getText(): string
    {
        return $this->value;
    }
}
