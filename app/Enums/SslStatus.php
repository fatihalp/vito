<?php

namespace App\Enums;

use App\Enums\Concerns\TextIsValue;
use App\Contracts\VitoEnum;

enum SslStatus: string implements VitoEnum
{
    use TextIsValue;

    case CREATED = 'created';
    case CREATING = 'creating';
    case DELETING = 'deleting';
    case FAILED = 'failed';

    public function getColor(): string
    {
        return match ($this) {
            self::CREATED => 'success',
            self::CREATING,
            self::DELETING => 'warning',
            self::FAILED => 'danger',
        };
    }
}
