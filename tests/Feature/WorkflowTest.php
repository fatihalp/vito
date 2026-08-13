<?php

use App\Models\Workflow;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia;

uses(RefreshDatabase::class);

test('see workflows list', function () {
    $this->actingAs($this->user);

    Workflow::factory()->create([
        'user_id' => $this->user->id,
        'project_id' => $this->user->current_project_id,
    ]);

    $this->get(route('workflows'))
        ->assertSuccessful()
        ->assertInertia(fn (AssertableInertia $page) => $page->component('workflows/index'));
});

test('see workflow', function () {
    $this->actingAs($this->user);

    /** @var Workflow $workflow */
    $workflow = Workflow::factory()->create([
        'user_id' => $this->user->id,
        'project_id' => $this->user->current_project_id,
    ]);

    $this->get(route('workflows.show', $workflow))
        ->assertSuccessful()
        ->assertInertia(fn (AssertableInertia $page) => $page->component('workflows/show'));
});

test('create workflow', function () {
    $this->actingAs($this->user);

    $this->post(route('workflows.store'), [
        'name' => 'My Workflow',
    ])->assertRedirect();

    $this->assertDatabaseHas('workflows', [
        'project_id' => $this->user->current_project_id,
        'name' => 'My Workflow',
    ]);
});

test('import workflow', function () {
    $this->actingAs($this->user);

    $this->post(route('workflows.import'), [
        'name' => 'Imported Workflow',
        'nodes' => [
            [
                'id' => 'create-server',
                'data' => [
                    'action' => [
                        'label' => 'Create Server',
                        'handler' => 'App\\WorkflowActions\\Server\\CreateServer',
                        'starting' => true,
                        'inputs' => [],
                    ],
                ],
            ],
        ],
        'edges' => [],
    ])->assertRedirect();

    $this->assertDatabaseHas('workflows', [
        'project_id' => $this->user->current_project_id,
        'name' => 'Imported Workflow',
    ]);

    $workflow = Workflow::query()->where('name', 'Imported Workflow')->firstOrFail();

    expect($workflow->getStartingNode())->not->toBeNull();
});

test('import workflow requires a starting node', function () {
    $this->actingAs($this->user);

    $this->post(route('workflows.import'), [
        'name' => 'Invalid Workflow',
        'nodes' => [
            [
                'id' => 'create-server',
                'data' => [
                    'action' => [
                        'label' => 'Create Server',
                        'handler' => 'App\\WorkflowActions\\Server\\CreateServer',
                        'starting' => false,
                        'inputs' => [],
                    ],
                ],
            ],
        ],
        'edges' => [],
    ])->assertRedirect();

    $this->assertDatabaseMissing('workflows', [
        'name' => 'Invalid Workflow',
    ]);
});

test('export workflow', function () {
    $this->actingAs($this->user);

    /** @var Workflow $workflow */
    $workflow = Workflow::factory()->create([
        'user_id' => $this->user->id,
        'project_id' => $this->user->current_project_id,
        'payload' => [
            'nodes' => [['id' => 'create-server']],
            'edges' => [],
        ],
    ]);

    $response = $this->get(route('workflows.export', $workflow))
        ->assertSuccessful()
        ->assertHeader('Content-Disposition');

    $response->assertJson([
        'name' => $workflow->name,
        'nodes' => [['id' => 'create-server']],
        'edges' => [],
    ]);
});

test('delete workflow', function () {
    $this->actingAs($this->user);

    /** @var Workflow $workflow */
    $workflow = Workflow::factory()->create([
        'user_id' => $this->user->id,
        'project_id' => $this->user->current_project_id,
    ]);

    $this->delete(route('workflows.destroy', $workflow))
        ->assertRedirect();

    $this->assertSoftDeleted('workflows', [
        'id' => $workflow->id,
    ]);
});
