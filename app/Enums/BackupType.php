<?php

namespace App\Enums;

use App\Enums\Concerns\TextIsValue;
use App\Contracts\VitoEnum;
use Forjed\InertiaTable\Contracts\HasTableDisplay;

enum BackupType: string implements HasTableDisplay, VitoEnum
{
    use TextIsValue;

    case DATABASE = 'database';
    case FILE = 'file';
    case PGBACKREST = 'pgbackrest';

    public function getColor(): string
    {
        return 'default';
    }
}
