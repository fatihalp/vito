<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

abstract class AbstractModel extends Model
{
    public function jsonUpdate(string $field, string $key, mixed $value, bool $save = true): void
    {
        $current = $this->{$field} ?? [];
        if (! is_array($current)) {
            $current = [];
        }
        $current[$key] = $value;
        $this->{$field} = $current;
        if ($save) {
            $this->save();
        }
    }

    public function jsonForget(string $field, string $key, bool $save = true): void
    {
        $current = $this->{$field} ?? [];
        unset($current[$key]);
        $this->{$field} = $current;
        if ($save) {
            $this->save();
        }
    }
}
