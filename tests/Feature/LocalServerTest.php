<?php

namespace Tests\Feature;

use App\Enums\OperatingSystem;
use App\Enums\ServerStatus;
use App\Enums\ServiceStatus;
use App\Facades\SSH;
use App\Models\Server;
use App\ServerProviders\Custom;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class LocalServerTest extends TestCase
{
    use RefreshDatabase;

    private function createLocalServer(): Server
    {
        $server = Server::factory()->create([
            'user_id' => $this->user->id,
            'project_id' => $this->user->current_project_id,
            'provider' => 'local',
            'ip' => '127.0.0.1',
            'port' => 22,
            'ssh_user' => 'vito',
            'name' => 'Vito',
            'os' => OperatingSystem::UBUNTU24,
            'status' => ServerStatus::READY,
            'progress' => 100,
        ]);

        $keys = $server->sshKey();
        if (! file_exists($keys['public_key_path']) || ! file_exists($keys['private_key_path'])) {
            $server->provider()->generateKeyPair();
        }

        $server->services()->create([
            'type' => 'webserver',
            'name' => 'nginx',
            'version' => 'latest',
            'status' => ServiceStatus::READY,
            'is_default' => true,
            'is_vito_service' => true,
        ]);
        $server->services()->create([
            'type' => 'php',
            'name' => 'php',
            'version' => '8.4',
            'status' => ServiceStatus::READY,
            'is_default' => true,
            'is_vito_service' => true,
        ]);
        $server->services()->create([
            'type' => 'memory_database',
            'name' => 'redis',
            'version' => 'latest',
            'status' => ServiceStatus::READY,
            'is_default' => true,
            'is_vito_service' => true,
        ]);
        $server->services()->create([
            'type' => 'process_manager',
            'name' => 'supervisor',
            'version' => 'latest',
            'status' => ServiceStatus::READY,
            'is_default' => true,
            'is_vito_service' => true,
        ]);

        return $server;
    }

    public function test_is_local(): void
    {
        $server = $this->createLocalServer();

        $this->assertTrue($server->isLocal());
        $this->assertFalse($this->server->isLocal());
    }

    public function test_cannot_create_server_with_local_provider(): void
    {
        $this->actingAs($this->user);

        Storage::fake();
        SSH::fake('user_not_found');

        $this->post(route('servers.store'), [
            'provider' => 'local',
            'name' => 'test',
            'os' => OperatingSystem::UBUNTU24->value,
            'services' => [],
        ])
            ->assertSessionHasErrors('provider');
    }

    public function test_cannot_delete_local_server(): void
    {
        $this->actingAs($this->user);

        $server = $this->createLocalServer();

        $this->delete(route('servers.destroy', ['server' => $server->id]))
            ->assertForbidden();

        $this->assertDatabaseHas('servers', [
            'id' => $server->id,
        ]);
    }

    public function test_cannot_reboot_local_server(): void
    {
        $this->actingAs($this->user);

        SSH::fake();

        $server = $this->createLocalServer();

        $this->post(route('servers.reboot', ['server' => $server->id]))
            ->assertSessionHasErrors();
    }

    public function test_cannot_transfer_local_server(): void
    {
        $this->actingAs($this->user);

        $server = $this->createLocalServer();

        $this->post(route('servers.transfer', ['server' => $server->id]), [
            'project_id' => $this->user->current_project_id,
        ])
            ->assertForbidden();
    }

    public function test_cannot_uninstall_vito_services(): void
    {
        $this->actingAs($this->user);

        SSH::fake();

        $server = $this->createLocalServer();

        $redis = $server->services()->where('name', 'redis')->first();

        $this->delete(route('services.destroy', [
            'server' => $server->id,
            'service' => $redis->id,
        ]))
            ->assertSessionHasErrors();
    }

    public function test_can_manage_vito_services(): void
    {
        $this->actingAs($this->user);

        SSH::fake();

        $server = $this->createLocalServer();

        $nginx = $server->services()->where('name', 'nginx')->first();

        $this->post(route('services.restart', [
            'server' => $server->id,
            'service' => $nginx->id,
        ]))
            ->assertSessionDoesntHaveErrors();
    }

    public function test_can_manage_non_vito_services_on_local_server(): void
    {
        $this->actingAs($this->user);

        SSH::fake();

        $server = $this->createLocalServer();

        $server->services()->create([
            'type' => 'webserver',
            'name' => 'nginx',
            'version' => 'latest',
            'status' => ServiceStatus::READY,
            'is_default' => false,
            'is_vito_service' => false,
        ]);

        $nonVitoNginx = $server->services()->where('is_vito_service', false)->first();

        $this->delete(route('services.destroy', [
            'server' => $server->id,
            'service' => $nonVitoNginx->id,
        ]))
            ->assertSessionDoesntHaveErrors();
    }

    public function test_setup_local_command_creates_server(): void
    {
        Server::query()->where('provider', 'local')->delete();

        $this->artisan('server:setup-local')
            ->assertSuccessful();

        $this->assertDatabaseHas('servers', [
            'provider' => 'local',
            'ip' => '127.0.0.1',
            'name' => 'Vito',
            'status' => ServerStatus::READY,
        ]);
    }

    public function test_setup_local_command_is_idempotent(): void
    {
        $this->createLocalServer();

        $this->artisan('server:setup-local')
            ->assertSuccessful()
            ->expectsOutput('Local server already exists. Skipping.');

        $this->assertEquals(1, Server::query()->where('provider', 'local')->count());
    }

    public function test_local_provider_hidden_from_config(): void
    {
        $providers = config('server-provider.providers');

        $this->assertTrue($providers['local']['hidden']);
        $this->assertFalse($providers[Custom::id()]['hidden']);
    }
}
