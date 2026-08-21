<?php

namespace App\DTOs;

readonly class DynamicForm
{
    
    public function __construct(
        private array $fields = [],
    ) {}

    
    public static function make(array $fields): self
    {
        return new self($fields);
    }

    
    public function toArray(): array
    {
        $fields = [];
        foreach ($this->fields as $field) {
            $fields[] = $field->toArray();
        }

        return $fields;
    }

    public function getFieldNames(): array
    {
        $fields = [];

        foreach ($this->fields as $field) {
            $name = $field->toArray()['name'] ?? null;
            if ($name) {
                $fields[] = $name;
            }
        }

        return $fields;
    }
}
