<?php

namespace App\Enums;

use App\Enums\Concerns\TextIsValue;
use App\Contracts\VitoEnum;
use Forjed\InertiaTable\Contracts\HasTableDisplay;

enum NetworkServerStatus: string implements HasTableDisplay, VitoEnum
{
    use TextIsValue;

    case PENDING = 'pending';
    case UPDATING = 'updating';
    case ACTIVE = 'active';
    case FAILED = 'failed';
    case LEAVING = 'leaving';

    public function getColor(): string
    {
        return match ($this) {
            self::PENDING => 'info',
            self::UPDATING,
            self::LEAVING => 'warning',
            self::ACTIVE => 'success',
            self::FAILED => 'danger',
        };
    }
}
