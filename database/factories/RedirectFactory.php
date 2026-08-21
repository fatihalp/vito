<?php

namespace Database\Factories;

use App\Enums\RedirectStatus;
use App\Models\Redirect;
use Illuminate\Database\Eloquent\Factories\Factory;


class RedirectFactory extends Factory
{
    protected $model = Redirect::class;

    
    public function definition(): array
    {
        return [
            'site_id' => 1,
            'from' => $this->faker->word,
            'to' => $this->faker->url,
            'mode' => $this->faker->randomElement([301, 302, 307, 308]),
            'websocket' => false,
            'status' => RedirectStatus::READY,
        ];
    }
}
