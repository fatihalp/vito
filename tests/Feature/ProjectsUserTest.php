<?php

use App\Enums\UserRole;
use App\Mail\ProjectInvitation;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia;

uses(RefreshDatabase::class);

test('user can invite others', function () {
    Mail::fake();

    $this->actingAs($this->user);

    $project = $this->user->ensureHasDefaultProject();
    $invitedUser = User::factory()->create();

    $this
        ->from(route('projects'))
        ->post(route('projects.users.store', ['project' => $project]), [
            'user_id' => $invitedUser->id,
            'role' => UserRole::ADMIN->value,
        ])
        ->assertRedirect(route('projects'))
        ->assertSessionDoesntHaveErrors()
        ->assertSessionHas('success');

    $this->assertDatabaseHas('user_project', [
        'project_id' => $project->id,
        'email' => $invitedUser->email,
    ]);

    Mail::assertSent(ProjectInvitation::class);
});

test('user can search for users to invite', function () {
    $this->actingAs($this->user);

    $project = $this->user->ensureHasDefaultProject();
    $candidate = User::factory()->create([
        'name' => 'Invite Candidate',
        'email' => 'candidate@example.com',
    ]);
    $existingUser = User::factory()->create([
        'name' => 'Candidate Existing Member',
        'email' => 'candidate-existing@example.com',
    ]);
    $project->users()->create([
        'user_id' => $existingUser->id,
        'role' => UserRole::USER,
    ]);
    $pendingUser = User::factory()->create([
        'name' => 'Candidate Pending User',
        'email' => 'candidate-pending@example.com',
    ]);
    $project->users()->create([
        'email' => $pendingUser->email,
        'role' => UserRole::USER,
    ]);

    $this->getJson(route('projects.users.json', [
        'project' => $project,
        'query' => $candidate->email,
    ]))
        ->assertSuccessful()
        ->assertJsonPath('0.id', $candidate->id)
        ->assertJsonMissing(['id' => $existingUser->id])
        ->assertJsonMissing(['id' => $pendingUser->id]);

    $this->getJson(route('projects.users.json', ['project' => $project]))
        ->assertSuccessful()
        ->assertExactJson([]);

    $this->getJson(route('projects.users.json', [
        'project' => $project,
        'query' => '%@example.com',
    ]))
        ->assertSuccessful()
        ->assertExactJson([]);
});

test('invalid invitee input returns validation errors', function () {
    $project = $this->user->ensureHasDefaultProject();

    $this->actingAs($this->user)
        ->post(route('projects.users.store', ['project' => $project]), [
            'user_id' => ['invalid'],
            'role' => UserRole::USER->value,
        ])
        ->assertSessionHasErrors('user_id');
});

test('same user can be invited to different projects only once per project', function () {
    Mail::fake();

    $firstProject = $this->user->ensureHasDefaultProject();
    $secondProject = Project::factory()->create();
    $secondProject->users()->create([
        'user_id' => $this->user->id,
        'role' => UserRole::OWNER,
    ]);
    $invitedUser = User::factory()->create();

    $this->actingAs($this->user)
        ->post(route('projects.users.store', ['project' => $firstProject]), [
            'user_id' => $invitedUser->id,
            'role' => UserRole::USER->value,
        ])
        ->assertSessionDoesntHaveErrors();

    $this->post(route('projects.users.store', ['project' => $secondProject]), [
        'user_id' => $invitedUser->id,
        'role' => UserRole::USER->value,
    ])->assertSessionDoesntHaveErrors();

    $this->post(route('projects.users.store', ['project' => $firstProject]), [
        'user_id' => $invitedUser->id,
        'role' => UserRole::USER->value,
    ])->assertSessionHasErrors('user_id');

    expect($firstProject->users()->where('email', $invitedUser->email)->count())->toBe(1)
        ->and($secondProject->users()->where('email', $invitedUser->email)->count())->toBe(1);
});

test('user without write access cannot search for users to invite', function () {
    $project = Project::factory()->create();
    $project->users()->create([
        'user_id' => $this->user->id,
        'role' => UserRole::USER,
    ]);

    $this->actingAs($this->user)
        ->getJson(route('projects.users.json', ['project' => $project]))
        ->assertForbidden();
});

test('can remove registered user from project', function () {
    $this->actingAs($this->user);

    $project = $this->user->ensureHasDefaultProject();

    /** @var User $newUser */
    $newUser = User::factory()->create();

    $userProject = $project->users()->create([
        'project_id' => $project->id,
        'user_id' => $newUser->id,
        'role' => UserRole::USER,
    ]);

    $this
        ->from(route('projects'))
        ->delete(route('projects.users.destroy', ['project' => $project, 'id' => $userProject->id]))
        ->assertRedirect(route('projects'))
        ->assertSessionDoesntHaveErrors()
        ->assertSessionHas('success');

    $this->assertDatabaseMissing('user_project', [
        'project_id' => $project->id,
        'user_id' => $newUser->id,
    ]);
});

test('can remove owner from project', function () {
    $this->actingAs($this->user);

    $project = $this->user->ensureHasDefaultProject();

    $id = $project->users()->where('user_id', $this->user->id)->first()->id;

    $this
        ->from(route('projects'))
        ->delete(route('projects.users.destroy', ['project' => $project, 'id' => $id]))
        ->assertSessionHas([
            'error' => __('You cannot remove the project owner.'),
        ]);
});

test('can remove invited user from project', function () {
    $this->actingAs($this->user);

    $project = $this->user->ensureHasDefaultProject();

    $userProject = $project->users()->create([
        'project_id' => $project->id,
        'email' => 'new-user@example.com',
        'role' => UserRole::USER,
    ]);

    $this
        ->from(route('projects'))
        ->delete(route('projects.users.destroy', ['project' => $project, 'id' => $userProject->id]))
        ->assertRedirect(route('projects'))
        ->assertSessionDoesntHaveErrors()
        ->assertSessionHas('success');

    $this->assertDatabaseMissing('user_project', [
        'project_id' => $project->id,
        'email' => 'new-user@example.com',
    ]);
});

test('user can accept invitation', function () {
    /** @var User $owner */
    $owner = User::factory()->create();
    $ownerProject = $owner->ensureHasDefaultProject();

    $this->actingAs($this->user);

    $ownerProject->users()->create([
        'email' => $this->user->email,
        'role' => UserRole::USER,
    ]);

    $this
        ->from(route('projects'))
        ->get(route('projects.invitations.accept', ['project' => $ownerProject]))
        ->assertRedirect(route('projects'))
        ->assertSessionHas('success');

    $this->assertDatabaseHas('user_project', [
        'project_id' => $ownerProject->id,
        'user_id' => $this->user->id,
    ]);
});

test('pending invitations are visible from every authenticated page', function () {
    /** @var User $owner */
    $owner = User::factory()->create();
    $owner->ensureHasDefaultProject()->users()->create([
        'email' => $this->user->email,
        'role' => UserRole::USER,
    ]);

    $this->actingAs($this->user)
        ->get(route('projects'))
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->where('auth.pendingInvitationsCount', 1)
            ->has('invitations.data', 1)
        );
});

test('user cannot join without invitation', function () {
    /** @var User $owner */
    $owner = User::factory()->create();
    $ownerProject = $owner->ensureHasDefaultProject();

    $this->actingAs($this->user);

    $this
        ->from(route('projects'))
        ->get(route('projects.invitations.accept', ['project' => $ownerProject]))
        ->assertNotFound();

    $this->assertDatabaseMissing('user_project', [
        'project_id' => $ownerProject->id,
        'user_id' => $this->user->id,
    ]);
});

test('user can leave project', function () {
    /** @var User $owner */
    $owner = User::factory()->create();
    $ownerProject = $owner->ensureHasDefaultProject();

    $this->actingAs($this->user);

    $ownerProject->users()->create([
        'email' => $this->user->email,
        'role' => UserRole::USER,
    ]);

    $this
        ->from(route('projects'))
        ->delete(route('projects.leave', ['project' => $ownerProject]))
        ->assertRedirect(route('projects'))
        ->assertSessionHas('success');

    $this->assertDatabaseMissing('user_project', [
        'project_id' => $ownerProject->id,
        'email' => $this->user->email,
    ]);
});

test('user can leave project that is not invited', function () {
    /** @var User $owner */
    $owner = User::factory()->create();
    $ownerProject = $owner->ensureHasDefaultProject();

    $this->actingAs($this->user);

    $this
        ->from(route('projects'))
        ->delete(route('projects.leave', ['project' => $ownerProject]))
        ->assertNotFound();
});

test('cannot delete yourself from project', function () {
    $this->actingAs($this->user);

    $project = Project::factory()->create();

    $userProject = $project->users()->create([
        'user_id' => $this->user->id,
        'role' => UserRole::ADMIN,
    ]);

    $this->delete(route('projects.users.destroy', ['project' => $project->id, 'id' => $userProject->id]))
        ->assertSessionHas([
            'error' => 'You cannot remove yourself from the project.',
        ]);
});

test('cannot delete the owner', function () {
    $this->actingAs($this->user);

    $project = Project::factory()->create();

    $userProject = $project->users()->create([
        'user_id' => $this->user->id,
        'role' => UserRole::OWNER,
    ]);

    $this->delete(route('projects.users.destroy', ['project' => $project->id, 'id' => $userProject->id]))
        ->assertSessionHas([
            'error' => 'You cannot remove the project owner.',
        ]);
});
