<?php

namespace Database\Factories;

use App\Models\Workflow;
use Illuminate\Database\Eloquent\Factories\Factory;

class WorkflowFactory extends Factory
{
    
    public function definition(): array
    {
        return [
            'user_id' => null,
            'project_id' => null,
            'name' => $this->faker->sentence(3),
            'payload' => null,
        ];
    }
}
