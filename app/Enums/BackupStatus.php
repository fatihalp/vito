<?php

namespace App\Enums;

use App\Contracts\VitoEnum;

enum BackupStatus: string implements VitoEnum
{
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

    public function getText(): string
    {
        return $this->value;
    }
}
