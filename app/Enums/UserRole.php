<?php

namespace App\Enums;

use App\Enums\Concerns\TextIsValue;
use App\Contracts\VitoEnum;

enum UserRole: string implements VitoEnum
{
    use TextIsValue;

    case USER = 'user';
    case ADMIN = 'admin';
    case OWNER = 'owner';

    public function getColor(): string
    {
        return 'default';
    }
}
