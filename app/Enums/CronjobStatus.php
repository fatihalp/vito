<?php

namespace App\Enums;

use App\Enums\Concerns\TextIsValue;
use App\Contracts\VitoEnum;

enum CronjobStatus: string implements VitoEnum
{
    use TextIsValue;

    case CREATING = 'creating';
    case READY = 'ready';
    case DELETING = 'deleting';
    case ENABLING = 'enabling';
    case DISABLING = 'disabling';
    case UPDATING = 'updating';
    case DISABLED = 'disabled';

    public function getColor(): string
    {
        return match ($this) {
            self::CREATING,
            self::ENABLING,
            self::UPDATING,
            self::DISABLING => 'warning',
            self::READY => 'success',
            self::DELETING => 'danger',
            self::DISABLED => 'gray',
        };
    }
}
