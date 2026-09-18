<?php

namespace App\Enums;

use App\Contracts\VitoEnum;

enum StorageMigrationStatus: string implements VitoEnum
{
    case PENDING = 'pending';
    case SCANNING = 'scanning';
    case RUNNING = 'running';
    case PAUSED = 'paused';
    case VERIFYING = 'verifying';
    case COMPLETED = 'completed';
    case PARTIAL = 'partial';
    case FAILED = 'failed';
    case CANCELLED = 'cancelled';

    public function getColor(): string
    {
        return match ($this) {
            self::COMPLETED => 'success',
            self::SCANNING,
            self::RUNNING,
            self::VERIFYING,
            self::PENDING => 'warning',
            self::PAUSED => 'info',
            self::PARTIAL,
            self::FAILED => 'danger',
            self::CANCELLED => 'gray',
        };
    }

    public function getText(): string
    {
        return $this->value;
    }

    public function isActive(): bool
    {
        return in_array($this, [self::PENDING, self::SCANNING, self::RUNNING, self::VERIFYING]);
    }

    public function isOpen(): bool
    {
        return $this->isActive() || $this === self::PAUSED;
    }
}
