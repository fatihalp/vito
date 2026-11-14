<?php

namespace App\Enums;

use App\Contracts\VitoEnum;

enum DeploymentTrigger: string implements VitoEnum
{
    case MANUAL = 'manual';
    case WEBHOOK = 'webhook';

    public function getColor(): string
    {
        return match ($this) {
            self::MANUAL => 'info',
            self::WEBHOOK => 'gray',
        };
    }

    public function getText(): string
    {
        return match ($this) {
            self::MANUAL => 'manual',
            self::WEBHOOK => 'git push',
        };
    }
}
