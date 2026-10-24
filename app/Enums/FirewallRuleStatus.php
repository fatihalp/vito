<?php

namespace App\Enums;

use App\Enums\Concerns\TextIsValue;
use App\Contracts\VitoEnum;
use Forjed\InertiaTable\Contracts\HasTableDisplay;

enum FirewallRuleStatus: string implements HasTableDisplay, VitoEnum
{
    use TextIsValue;

    case CREATING = 'creating';
    case UPDATING = 'updating';
    case READY = 'ready';
    case DELETING = 'deleting';
    case FAILED = 'failed';

    public function getColor(): string
    {
        return match ($this) {
            self::CREATING => 'info',
            self::UPDATING => 'warning',
            self::DELETING,
            self::FAILED => 'danger',
            self::READY => 'success',
        };
    }
}
