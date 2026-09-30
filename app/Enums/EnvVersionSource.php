<?php

namespace App\Enums;

use App\Contracts\VitoEnum;

enum EnvVersionSource: string implements VitoEnum
{
    case EDITOR = 'editor';
    case RESTORE = 'restore';
    case RESOURCE = 'resource';
    case SERVER = 'server';

    public function getColor(): string
    {
        return match ($this) {
            self::EDITOR => 'info',
            self::RESTORE => 'warning',
            self::RESOURCE => 'gray',
            self::SERVER => 'danger',
        };
    }

    public function getText(): string
    {
        return match ($this) {
            self::EDITOR => 'edited',
            self::RESTORE => 'restored',
            self::RESOURCE => 'resource sync',
            self::SERVER => 'changed on server',
        };
    }
}
