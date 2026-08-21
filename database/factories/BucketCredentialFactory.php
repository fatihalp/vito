<?php

namespace Database\Factories;

use App\Models\BucketCredential;
use App\Models\Project;
use Illuminate\Database\Eloquent\Factories\Factory;


class BucketCredentialFactory extends Factory
{
    public function definition(): array
    {
        return [
            'project_id' => Project::factory(),
            'credentials' => [
                'access_key' => 'test-access-key',
                'secret_key' => 'test-secret-key',
            ],
        ];
    }
}
