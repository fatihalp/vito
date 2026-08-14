<?php

use App\Actions\Bucket\ConnectBucketCredentials;
use App\Enums\UserRole;
use App\Models\Bucket;
use App\Models\BucketCredential;
use App\Support\HetznerObjectStorage;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);

function mockedConnectAction(bool $accepted): ConnectBucketCredentials
{
    $storage = test()->getMockBuilder(HetznerObjectStorage::class)
        ->disableOriginalConstructor()
        ->onlyMethods(['connect'])
        ->getMock();
    $storage->method('connect')->willReturn($accepted);

    $action = test()->getMockBuilder(ConnectBucketCredentials::class)
        ->onlyMethods(['makeClient'])
        ->getMock();
    $action->method('makeClient')->willReturn($storage);

    return $action;
}

test('connect stores the project credential when hetzner accepts it', function () {
    $credential = mockedConnectAction(accepted: true)->connect($this->user->currentProject, [
        'access_key' => 'the-access-key',
        'secret_key' => 'the-secret-key',
    ]);

    expect($credential->credentials)->toEqual(['access_key' => 'the-access-key', 'secret_key' => 'the-secret-key']);
    $this->assertDatabaseHas('bucket_credentials', ['project_id' => $this->user->current_project_id]);
});

test('connect rejects credentials hetzner does not accept', function () {
    try {
        mockedConnectAction(accepted: false)->connect($this->user->currentProject, [
            'access_key' => 'bad-key',
            'secret_key' => 'bad-secret',
        ]);
        $this->fail('Expected ValidationException was not thrown.');
    } catch (ValidationException $e) {
        expect($e->errors())->toHaveKey('access_key');
    }

    $this->assertDatabaseMissing('bucket_credentials', ['project_id' => $this->user->current_project_id]);
});

test('connect replaces an existing credential pair', function () {
    mockedConnectAction(accepted: true)->connect($this->user->currentProject, [
        'access_key' => 'first-key',
        'secret_key' => 'first-secret',
    ]);
    mockedConnectAction(accepted: true)->connect($this->user->currentProject, [
        'access_key' => 'second-key',
        'secret_key' => 'second-secret',
    ]);

    expect(BucketCredential::query()->where('project_id', $this->user->current_project_id)->count())->toBe(1);

    $credential = BucketCredential::query()->where('project_id', $this->user->current_project_id)->firstOrFail();
    expect($credential->credentials)->toEqual(['access_key' => 'second-key', 'secret_key' => 'second-secret']);
});

test('disconnect removes the credential but leaves existing buckets untouched', function () {
    $this->actingAs($this->user);

    $credential = BucketCredential::factory()->create(['project_id' => $this->user->current_project_id]);
    $bucket = Bucket::factory()->create(['project_id' => $this->user->current_project_id]);
    $originalConfiguration = $bucket->configuration;

    $this->delete(route('buckets.credentials.destroy'))->assertRedirect();

    $this->assertDatabaseMissing('bucket_credentials', ['id' => $credential->id]);

    $bucket->refresh();
    expect($bucket->configuration)->toEqual($originalConfiguration);
});

test('guest cannot manage bucket credentials', function () {
    $this->post(route('buckets.credentials.store'), ['access_key' => 'a', 'secret_key' => 'b'])
        ->assertRedirect('/');

    $this->delete(route('buckets.credentials.destroy'))
        ->assertRedirect('/');
});

test('read only project member cannot manage bucket credentials', function () {
    $this->actingAs($this->user);

    $this->user->currentProject->users()->where('user_id', $this->user->id)->update(['role' => UserRole::USER]);

    $this->post(route('buckets.credentials.store'), ['access_key' => 'a', 'secret_key' => 'b'])
        ->assertForbidden();

    $this->delete(route('buckets.credentials.destroy'))
        ->assertForbidden();
});
