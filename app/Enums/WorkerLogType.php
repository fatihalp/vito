<?php

namespace App\Enums;

use App\Contracts\VitoEnum;
use App\Enums\Concerns\TextIsValue;

enum WorkerLogType: string implements VitoEnum
{
    use TextIsValue;

    case STARTED = 'started';
    case STOPPED = 'stopped';
    case RESTARTED = 'restarted';
    case CREATED = 'created';
    case FAILED = 'failed';

    public function getColor(): string
    {
        return match ($this) {
            self::STARTED => 'success',
            self::RESTARTED => 'info',
            self::CREATED => 'default',
            self::STOPPED => 'gray',
            self::FAILED => 'danger',
        };
    }
}
