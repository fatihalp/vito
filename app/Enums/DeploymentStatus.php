<?php

namespace App\Enums;

use App\Enums\Concerns\TextIsValue;
use App\Contracts\VitoEnum;
use Forjed\InertiaTable\Contracts\HasTableDisplay;

enum DeploymentStatus: string implements HasTableDisplay, VitoEnum
{
    use TextIsValue;

    case DEPLOYING = 'deploying';
    case FINISHED = 'finished';
    case FAILED = 'failed';
    case CANCELLED = 'cancelled';

    public function getColor(): string
    {
        return match ($this) {
            self::DEPLOYING => 'warning',
            self::FINISHED => 'success',
            self::FAILED => 'danger',
            self::CANCELLED => 'gray',
        };
    }
}
