<?php

namespace App\Traits;

use ReflectionClass;

trait HasEnumHelpers
{
    
    public static function all(): array
    {
        $reflection = new ReflectionClass(self::class);
        $constants = $reflection->getConstants();

        return array_map(fn ($case) => $case->value, $constants);
    }

    
    public static function allValues(): array
    {
        $reflection = new ReflectionClass(self::class);
        $constants = $reflection->getConstants();

        return array_values($constants);
    }
}
