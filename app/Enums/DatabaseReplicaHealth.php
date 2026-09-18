<?php

namespace App\Enums;

use App\Contracts\VitoEnum;

enum DatabaseReplicaHealth: string implements VitoEnum
{
    case HEALTHY = 'healthy';
    case WARNING = 'warning';
    case CRITICAL = 'critical';
    case UNKNOWN = 'unknown';

    public function getColor(): string
    {
        return match ($this) {
            self::HEALTHY => 'success',
            self::WARNING => 'warning',
            self::CRITICAL => 'danger',
            self::UNKNOWN => 'gray',
        };
    }

    public function getText(): string
    {
        return $this->value;
    }
}
