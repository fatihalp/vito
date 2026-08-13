<?php

use App\Facades\SSH;
use App\Http\Resources\CommandExecutionResource;
use App\Models\Command;
use App\Models\CommandExecution;
use App\Models\Project;
use App\Models\Server;
use App\Models\Site;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;

uses(RefreshDatabase::class);

test('see commands', function () {
    $this->actingAs($this->user);

    $this->get(route('commands', [
        'server' => $this->server,
        'site' => $this->site,
    ]))
        ->assertSuccessful()
        ->assertInertia(fn (AssertableInertia $page) => $page->component('commands/index'));
});

test('create command', function () {
    $this->actingAs($this->user);

    $this->post(route('commands.store', [
        'server' => $this->server,
        'site' => $this->site,
    ]), [
        'name' => 'Test Command',
        'command' => 'echo "${MESSAGE}"',
    ])
        ->assertSessionDoesntHaveErrors();

    $this->assertDatabaseHas('commands', [
        'site_id' => $this->site->id,
        'name' => 'Test Command',
        'command' => 'echo "${MESSAGE}"',
    ]);
});

test('edit command', function () {
    $this->actingAs($this->user);

    $command = $this->site->commands()->create([
        'name' => 'Test Command',
        'command' => 'echo "${MESSAGE}"',
    ]);

    $this->put(route('commands.update', [
        'server' => $this->server,
        'site' => $this->site,
        'command' => $command,
    ]), [
        'name' => 'Updated Command',
        'command' => 'ls -la',
    ])
        ->assertSessionDoesntHaveErrors();

    $this->assertDatabaseHas('commands', [
        'id' => $command->id,
        'site_id' => $this->site->id,
        'name' => 'Updated Command',
        'command' => 'ls -la',
    ]);
});

test('delete command', function () {
    $this->actingAs($this->user);

    $command = $this->site->commands()->create([
        'name' => 'Test Command',
        'command' => 'echo "${MESSAGE}"',
    ]);

    $this->delete(route('commands.destroy', [
        'server' => $this->server,
        'site' => $this->site,
        'command' => $command,
    ]))
        ->assertSessionDoesntHaveErrors();

    $this->assertDatabaseMissing('commands', [
        'id' => $command->id,
    ]);
});

test('execute command', function () {
    SSH::fake('echo "Hello, world!"');

    $this->actingAs($this->user);

    /** @var Command $command */
    $command = $this->site->commands()->create([
        'name' => 'Test Command',
        'command' => 'echo "${MESSAGE}"',
    ]);

    $this->post(route('commands.execute', [
        'server' => $this->server,
        'site' => $this->site,
        'command' => $command,
    ]), [
        'MESSAGE' => 'Hello, world!',
    ])
        ->assertRedirect(route('commands.show', [
            'server' => $this->server,
            'site' => $this->site,
            'command' => $command,
        ]))
        ->assertSessionDoesntHaveErrors();

    $this->assertDatabaseHas('command_executions', [
        'command_id' => $command->id,
        'variables' => $this->castAsJson(['MESSAGE' => 'Hello, world!']),
    ]);
});

test('quick run creates and executes a command', function () {
    SSH::fake('Vito');

    $this->actingAs($this->user);

    $this->post(route('commands.quick-run', [
        'server' => $this->server,
        'site' => $this->site,
    ]), [
        'command' => 'php artisan about',
    ])
        ->assertSessionDoesntHaveErrors();

    $command = $this->site->commands()->where('command', 'php artisan about')->firstOrFail();

    expect($command->is_raw)->toBeTrue();

    $this->assertDatabaseHas('command_executions', [
        'command_id' => $command->id,
        'user_id' => $this->user->id,
    ]);
});

test('quick run reuses an existing command', function () {
    SSH::fake('Vito');

    $command = $this->site->commands()->create([
        'name' => 'About',
        'command' => 'php artisan about',
        'is_raw' => true,
    ]);

    $this->actingAs($this->user);

    $this->post(route('commands.quick-run', [
        'server' => $this->server,
        'site' => $this->site,
    ]), [
        'command' => 'php artisan about',
    ])->assertSessionDoesntHaveErrors();

    expect($this->site->commands()->where('command', 'php artisan about')->count())->toBe(1);
    $this->assertDatabaseHas('command_executions', ['command_id' => $command->id]);
});

test('quick run treats case-sensitive shell commands as distinct', function () {
    SSH::fake('Vito');

    $this->site->commands()->create([
        'name' => 'Lowercase',
        'command' => 'echo vito',
        'is_raw' => true,
    ]);

    $this->actingAs($this->user);

    $this->post(route('commands.quick-run', [
        'server' => $this->server,
        'site' => $this->site,
    ]), [
        'command' => 'echo VITO',
    ])->assertSessionDoesntHaveErrors();

    expect($this->site->commands()->where('is_raw', true)->get()->pluck('command')->all())
        ->toContain('echo vito', 'echo VITO');
});

test('quick run executes shell variables literally', function () {
    SSH::fake('Vito');

    $this->actingAs($this->user);

    $this->post(route('commands.quick-run', [
        'server' => $this->server,
        'site' => $this->site,
    ]), [
        'command' => 'echo "${MESSAGE}"',
    ])
        ->assertSessionDoesntHaveErrors();

    $command = $this->site->commands()->where('command', 'echo "${MESSAGE}"')->firstOrFail();
    $execution = $command->executions()->firstOrFail();

    expect($command->is_raw)->toBeTrue()
        ->and($command->getVariables())->toBe([])
        ->and($execution->getContent())->toBe('echo "${MESSAGE}"');
});

test('quick run rejects a site outside the selected server', function () {
    SSH::fake('Vito');

    $otherProject = Project::factory()->create();
    $otherServer = Server::factory()->create([
        'project_id' => $otherProject->id,
    ]);
    $otherSite = Site::factory()->create([
        'server_id' => $otherServer->id,
    ]);

    $this->actingAs($this->user);

    $this->post(route('commands.quick-run', [
        'server' => $this->server,
        'site' => $otherSite,
    ]), [
        'command' => 'whoami',
    ])->assertForbidden();

    $this->assertDatabaseMissing('commands', [
        'site_id' => $otherSite->id,
        'command' => 'whoami',
    ]);
});

test('execute command validation error', function () {
    $this->actingAs($this->user);

    $command = $this->site->commands()->create([
        'name' => 'Test Command',
        'command' => 'echo "${MESSAGE}"',
    ]);

    $this->post(route('commands.execute', [
        'server' => $this->server,
        'site' => $this->site,
        'command' => $command,
    ]))
        ->assertSessionHasErrors();
});

test('command history does not expose execution variable values', function () {
    $this->actingAs($this->user);

    /** @var Command $command */
    $command = $this->site->commands()->create([
        'name' => 'Deploy',
        'command' => 'deploy --token="${TOKEN}"',
    ]);
    $command->executions()->create([
        'server_id' => $this->server->id,
        'user_id' => $this->user->id,
        'variables' => ['TOKEN' => 'secret-token'],
        'status' => 'completed',
    ]);

    $this->get(route('commands.show', [
        'server' => $this->server,
        'site' => $this->site,
        'command' => $command,
    ]))->assertInertia(fn (AssertableInertia $page) => $page
        ->where('executions.data.0.variables.TOKEN', null)
        ->missing('executions.data.0.variables.secret-token')
    );
});

test('command execution resource handles legacy null variables', function () {
    /** @var CommandExecution $execution */
    $execution = CommandExecution::factory()->create([
        'server_id' => $this->server->id,
        'user_id' => $this->user->id,
        'variables' => null,
    ]);

    expect((new CommandExecutionResource($execution))->resolve()['variables'])->toBe([]);
});
