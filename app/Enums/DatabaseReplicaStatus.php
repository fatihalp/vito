<?php

namespace App\Enums;

use App\Contracts\VitoEnum;

enum DatabaseReplicaStatus: string implements VitoEnum
{
    case PENDING = 'pending';
    case WAITING_FOR_BACKUP = 'waiting_for_backup';
    case CONFIGURING = 'configuring';
    case SEEDING = 'seeding';
    case READY = 'ready';
    case FAILED = 'failed';
    case NEEDS_REBUILD = 'needs_rebuild';
    case PROMOTING = 'promoting';
    case DELETING = 'deleting';

    public function getColor(): string
    {
        return match ($this) {
            self::READY => 'success',
            self::FAILED, self::NEEDS_REBUILD => 'danger',
            self::WAITING_FOR_BACKUP => 'info',
            default => 'warning',
        };
    }

    public function getText(): string
    {
        return $this->value;
    }

    public function isBusy(): bool
    {
        return in_array($this, [self::PENDING, self::CONFIGURING, self::PROMOTING, self::DELETING], true);
    }

    public function isReplicating(): bool
    {
        return ! in_array($this, [self::NEEDS_REBUILD, self::PROMOTING, self::DELETING], true);
    }
}
