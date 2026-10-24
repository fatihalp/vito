<?php

namespace App\Enums;

use App\Enums\Concerns\TextIsValue;
use App\Contracts\VitoEnum;
use App\Traits\HasEnumHelpers;

enum SslType: string implements VitoEnum
{
    use TextIsValue;

    use HasEnumHelpers;

    case LETSENCRYPT = 'letsencrypt';
    case CUSTOM = 'custom';
    case CSR = 'csr';

    public function getColor(): string
    {
        return match ($this) {
            self::LETSENCRYPT,
            self::CUSTOM,
            self::CSR => 'default',
        };
    }
}
