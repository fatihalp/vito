<?php

namespace Database\Factories;

use App\Models\ServerTemplate;
use Illuminate\Database\Eloquent\Factories\Factory;


class ServerTemplateFactory extends Factory
{
    
    public function definition(): array
    {
        return [
            'user_id' => 1,
            'name' => $this->faker->word(),
            'services' => [
                'php' => '8.4',
            ],
        ];
    }
}
