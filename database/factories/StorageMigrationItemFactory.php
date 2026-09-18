<?php

namespace Database\Factories;

use App\Enums\StorageMigrationItemStatus;
use App\Models\StorageMigrationItem;
use Illuminate\Database\Eloquent\Factories\Factory;

class StorageMigrationItemFactory extends Factory
{
    protected $model = StorageMigrationItem::class;

    public function definition(): array
    {
        return [
            'status' => StorageMigrationItemStatus::PENDING,
            'attempts' => 0,
        ];
    }
}
