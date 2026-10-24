<?php

namespace App\Enums;

use App\Enums\Concerns\TextIsValue;
use App\Contracts\VitoEnum;

enum BackupStatus: string implements VitoEnum
{
    use TextIsValue;

    case DELETING = 'deleting';
    case INSTALLING = 'installing';
    case FAILED = 'failed';

    public function getColor(): string
    {
        return match ($this) {
            self::DELETING,
            self::INSTALLING => 'warning',
            self::FAILED => 'danger',
        };
    }
}
