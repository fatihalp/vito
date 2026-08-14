<?php

namespace Database\Factories;

use App\Enums\OperatingSystem;
use App\Enums\ServerRole;
use App\Enums\ServerStatus;
use App\Models\Server;
use App\ServerProviders\Custom;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Server>
 */
class ServerFactory extends Factory
{
    protected $model = Server::class;

    public function definition(): array
    {
        return [
            'project_id' => 1,
            'user_id' => 1,
            'name' => $this->faker->name(),
            'role' => ServerRole::APP,
            'ssh_user' => 'vito',
            'ip' => $this->faker->ipv4(),
            'local_ip' => $this->faker->ipv4(),
            'port' => 22,
            'os' => OperatingSystem::UBUNTU24,
            'provider' => Custom::id(),
            'authentication' => [
                'user' => 'vito',
                'pass' => 'password',
            ],
            'public_key' => 'test',
            'status' => ServerStatus::READY,
            'progress' => 100,
        ];
    }
}
