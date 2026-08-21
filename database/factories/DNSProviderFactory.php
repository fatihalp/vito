<?php

namespace Database\Factories;

use App\Models\DNSProvider;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;


class DNSProviderFactory extends Factory
{
    
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'project_id' => null,
            'provider' => 'cloudflare',
            'name' => $this->faker->word(),
            'credentials' => [
                'token' => $this->faker->sha256(),
            ],
            'connected' => true,
        ];
    }
}
