<?php

namespace App\Enums;

use App\Contracts\VitoEnum;
use App\Enums\Concerns\TextIsValue;

enum BackupMonitorStatus: string implements VitoEnum
{
    use TextIsValue;

    case UNKNOWN = 'unknown';
    case HEALTHY = 'healthy';
    case RUNNING = 'running';
    case WARNING = 'warning';
    case FAILED = 'failed';

    public function getColor(): string
    {
        return match ($this) {
            self::HEALTHY => 'success',
            self::FAILED => 'danger',
            self::WARNING => 'warning',
            default => 'gray',
        };
    }
}
