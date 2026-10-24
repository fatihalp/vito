<?php

namespace App\Enums;

use App\Enums\Concerns\TextIsValue;
use App\Contracts\VitoEnum;

enum PHPIniType: string implements VitoEnum
{
    use TextIsValue;

    case CLI = 'cli';
    case FPM = 'fpm';

    public function getColor(): string
    {
        return 'default';
    }
}
