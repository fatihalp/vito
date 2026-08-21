<?php

namespace App\Enums;

use App\Contracts\VitoEnum;

enum SiteResourceType: string implements VitoEnum
{
    case DATABASE = 'database';
    case CACHE = 'cache';
    case BUCKET = 'bucket';

    public function getColor(): string
    {
        return match ($this) {
            self::DATABASE => 'success',
            self::CACHE => 'default',
            self::BUCKET => 'info',
        };
    }

    public function getText(): string
    {
        return match ($this) {
            self::DATABASE => 'Database',
            self::CACHE => 'Cache (Redis)',
            self::BUCKET => 'Bucket',
        };
    }

    public function serverRole(): ?ServerRole
    {
        return match ($this) {
            self::DATABASE => ServerRole::DATABASE,
            self::CACHE => ServerRole::CACHE,
            self::BUCKET => null,
        };
    }
}
