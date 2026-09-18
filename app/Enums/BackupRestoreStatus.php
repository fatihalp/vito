<?php

namespace App\Enums;

use App\Contracts\VitoEnum;

enum BackupRestoreStatus: string implements VitoEnum
{
    case WAITING_FOR_SERVER = 'waiting_for_server';
    case RESTORING = 'restoring';
    case COMPLETED = 'completed';
    case FAILED = 'failed';

    public function getColor(): string
    {
        return match ($this) {
            self::WAITING_FOR_SERVER, self::RESTORING => 'warning',
            self::COMPLETED => 'success',
            self::FAILED => 'danger',
        };
    }

    public function getText(): string
    {
        return match ($this) {
            self::WAITING_FOR_SERVER => 'waiting for the server',
            self::RESTORING => 'restoring',
            self::COMPLETED => 'completed',
            self::FAILED => 'failed',
        };
    }
}
