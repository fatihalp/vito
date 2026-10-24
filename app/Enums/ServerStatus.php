<?php

namespace App\Enums;

use App\Enums\Concerns\TextIsValue;
use App\Contracts\VitoEnum;
use Forjed\InertiaTable\Contracts\HasTableDisplay;

enum ServerStatus: string implements HasTableDisplay, VitoEnum
{
    use TextIsValue;

    case READY = 'ready';
    case INSTALLING = 'installing';
    case INSTALLATION_FAILED = 'installation_failed';
    case DISCONNECTED = 'disconnected';
    case UPDATING = 'updating';

    public function getColor(): string
    {
        return match ($this) {
            self::READY => 'success',
            self::INSTALLING,
            self::UPDATING => 'warning',
            self::DISCONNECTED => 'gray',
            self::INSTALLATION_FAILED => 'danger',
        };
    }
}
