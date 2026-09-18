<?php

namespace App\Enums;

use App\Contracts\VitoEnum;
use Forjed\InertiaTable\Contracts\HasTableDisplay;

enum BackupType: string implements HasTableDisplay, VitoEnum
{
    case DATABASE = 'database';
    case FILE = 'file';
    case PGBACKREST = 'pgbackrest';

    public function getColor(): string
    {
        return 'default';
    }

    public function getText(): string
    {
        return $this->value;
    }
}
