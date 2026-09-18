<?php

namespace Database\Factories;

use App\Enums\StorageMigrationStatus;
use App\Models\StorageMigration;
use Illuminate\Database\Eloquent\Factories\Factory;

class StorageMigrationFactory extends Factory
{
    protected $model = StorageMigration::class;

    public function definition(): array
    {
        return [
            'overwrite' => false,
            'status' => StorageMigrationStatus::PENDING,
        ];
    }
}
