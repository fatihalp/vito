<?php

namespace App\Enums;

use App\Enums\Concerns\TextIsValue;
use App\Contracts\VitoEnum;

enum StorageMigrationItemStatus: string implements VitoEnum
{
    use TextIsValue;

    case PENDING = 'pending';
    case PROCESSING = 'processing';
    case COPIED = 'copied';
    case SKIPPED = 'skipped';
    case FAILED = 'failed';

    public function getColor(): string
    {
        return match ($this) {
            self::COPIED => 'success',
            self::SKIPPED => 'info',
            self::PENDING,
            self::PROCESSING => 'warning',
            self::FAILED => 'danger',
        };
    }
}
