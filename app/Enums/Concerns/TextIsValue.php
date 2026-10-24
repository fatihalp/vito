<?php

namespace App\Enums\Concerns;

trait TextIsValue
{
    public function getText(): string
    {
        return $this->value;
    }
}
