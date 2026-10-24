<?php

namespace App\Enums;

use App\Enums\Concerns\TextIsValue;
use App\Contracts\VitoEnum;

enum SshKeyStatus: string implements VitoEnum
{
    use TextIsValue;

    case ADDING = 'adding';
    case ADDED = 'added';
    case DELETING = 'deleting';

    public function getColor(): string
    {
        return match ($this) {
            self::ADDED => 'success',
            self::ADDING => 'warning',
            self::DELETING => 'danger',
        };
    }
}
