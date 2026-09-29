<?php

namespace App\Enums;

use App\Contracts\VitoEnum;

enum DatabaseUpgradeStatus: string implements VitoEnum
{
    case WAITING_FOR_SERVER = 'waiting_for_server';
    case PREPARING = 'preparing';
    case COPYING = 'copying';
    case STREAMING = 'streaming';
    case FINISHING = 'finishing';
    case CANCELLING = 'cancelling';
    case COMPLETED = 'completed';
    case FAILED = 'failed';
    case CANCELLED = 'cancelled';

    public function getColor(): string
    {
        return match ($this) {
            self::STREAMING, self::COMPLETED => 'success',
            self::FAILED => 'danger',
            self::CANCELLED => 'gray',
            default => 'warning',
        };
    }

    public function getText(): string
    {
        return match ($this) {
            self::WAITING_FOR_SERVER => 'waiting for the server',
            self::PREPARING => 'preparing',
            self::COPYING => 'copying data',
            self::STREAMING => 'in sync',
            self::FINISHING => 'finishing',
            self::CANCELLING => 'cancelling',
            self::COMPLETED => 'completed',
            self::FAILED => 'failed',
            self::CANCELLED => 'cancelled',
        };
    }

    /**
     * The upgrade is running and its jobs keep working on it.
     */
    public function isActive(): bool
    {
        return in_array($this, [self::WAITING_FOR_SERVER, self::PREPARING, self::COPYING, self::STREAMING, self::FINISHING], true);
    }

    /**
     * Vito is working on the servers, so the upgrade must not be changed.
     */
    public function isBusy(): bool
    {
        return in_array($this, [self::WAITING_FOR_SERVER, self::PREPARING, self::FINISHING, self::CANCELLING], true);
    }
}
