<?php

namespace App\Enums;

use App\Enums\Concerns\TextIsValue;
use App\Contracts\VitoEnum;
use Forjed\InertiaTable\Contracts\HasTableDisplay;

enum DatabaseUserStatus: string implements HasTableDisplay, VitoEnum
{
    use TextIsValue;

    case READY = 'ready';
    case CREATING = 'creating';
    case FAILED = 'failed';
    case DELETING = 'deleting';

    public function getColor(): string
    {
        return match ($this) {
            self::READY => 'success',
            self::CREATING,
            self::DELETING => 'warning',
            self::FAILED => 'danger',
        };
    }
}
