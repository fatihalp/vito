<?php

namespace App\Enums;

use App\Contracts\VitoEnum;

enum RuntimeProcessStatus: string implements VitoEnum
{
    case RUNNING = 'running';
    case STOPPED = 'stopped';
    case FAILED = 'failed';
    case MASKED = 'masked';
    case UNKNOWN = 'unknown';

    public function getText(): string
    {
        return match ($this) {
            self::RUNNING => 'Active',
            self::STOPPED => 'Stopped',
            self::FAILED => 'Failed',
            self::MASKED => 'Masked',
            self::UNKNOWN => 'Not verified',
        };
    }

    public function getColor(): string
    {
        return match ($this) {
            self::RUNNING => 'success',
            self::STOPPED, self::UNKNOWN => 'gray',
            self::FAILED => 'danger',
            self::MASKED => 'warning',
        };
    }
}
