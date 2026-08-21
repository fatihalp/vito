<?php

namespace Database\Factories;

use App\Models\Bucket;
use App\Models\Project;
use App\Support\HetznerObjectStorage;
use Illuminate\Database\Eloquent\Factories\Factory;


class BucketFactory extends Factory
{
    public function definition(): array
    {
        $region = $this->faker->randomElement(array_keys(config('hetzner-object-storage.regions')));
        $name = $this->faker->unique()->slug(3);

        return [
            'project_id' => Project::factory(),
            'name' => $name,
            'driver' => 's3',
            'configuration' => [
                'endpoint' => HetznerObjectStorage::endpointFor($region),
                'region' => $region,
                'bucket' => $name,
                'access_key' => 'test-access-key',
                'secret_key' => 'test-secret-key',
                'path_style' => false,
                'visibility' => 'private',
                'allowed_origins' => [],
            ],
        ];
    }
}
