<?php

use App\Actions\Bucket\CreateBucket;
use App\Enums\UserRole;
use App\Facades\SSH;
use App\Models\Bucket;
use App\Models\BucketCredential;
use App\Support\HetznerObjectStorage;
use Aws\Command;
use Aws\S3\Exception\S3Exception;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia;

uses(RefreshDatabase::class);

test('see buckets index', function () {
    $this->actingAs($this->user);

    $this->get(route('buckets'))
        ->assertSuccessful()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('buckets/index')
            ->where('credentialsConnected', false)
        );
});

test('store fails when no hetzner credentials are connected', function () {
    $this->actingAs($this->user);

    $this->post(route('buckets.store'), [
        'name' => 'my-bucket',
        'region' => 'fsn1',
        'visibility' => 'private',
    ])->assertSessionHasErrors('name');

    $this->assertDatabaseMissing('buckets', ['name' => 'my-bucket']);
});

test('store validates the bucket name format', function () {
    $this->actingAs($this->user);

    BucketCredential::factory()->create(['project_id' => $this->user->current_project_id]);

    $this->post(route('buckets.store'), [
        'name' => 'Invalid_Name',
        'region' => 'fsn1',
        'visibility' => 'private',
    ])->assertSessionHasErrors('name');
});

test('store rejects a region outside the hetzner catalogue', function () {
    $this->actingAs($this->user);

    BucketCredential::factory()->create(['project_id' => $this->user->current_project_id]);

    $this->post(route('buckets.store'), [
        'name' => 'my-bucket',
        'region' => 'us-east-1',
        'visibility' => 'private',
    ])->assertSessionHasErrors('region');
});

test('create provisions a bucket via hetzner and copies the project credential into configuration', function () {
    $credential = BucketCredential::factory()->create([
        'project_id' => $this->user->current_project_id,
        'credentials' => ['access_key' => 'the-access-key', 'secret_key' => 'the-secret-key'],
    ]);

    $storage = $this->getMockBuilder(HetznerObjectStorage::class)
        ->setConstructorArgs(['the-access-key', 'the-secret-key', 'fsn1'])
        ->onlyMethods(['createBucket', 'putBucketAcl', 'putBucketCors'])
        ->getMock();

    $storage->expects($this->once())->method('createBucket')->with('my-bucket');
    $storage->expects($this->once())->method('putBucketAcl')->with('my-bucket', 'private');
    $storage->expects($this->never())->method('putBucketCors');

    $action = $this->getMockBuilder(CreateBucket::class)
        ->onlyMethods(['makeClient'])
        ->getMock();

    $action->method('makeClient')->willReturn($storage);

    $bucket = $action->create($credential->project, [
        'name' => 'my-bucket',
        'region' => 'fsn1',
        'visibility' => 'private',
    ]);

    expect($bucket->name)->toBe('my-bucket');
    expect($bucket->configuration['access_key'])->toBe('the-access-key');
    expect($bucket->configuration['secret_key'])->toBe('the-secret-key');
    expect($bucket->configuration['region'])->toBe('fsn1');
    expect($bucket->configuration['bucket'])->toBe('my-bucket');
    expect($bucket->configuration['path_style'])->toBeFalse();
    expect($bucket->configuration['endpoint'])->toBe('https://fsn1.your-objectstorage.com');

    $this->assertDatabaseHas('buckets', [
        'project_id' => $credential->project_id,
        'name' => 'my-bucket',
    ]);
});

test('create surfaces a hetzner name conflict as a validation error on name', function () {
    $credential = BucketCredential::factory()->create(['project_id' => $this->user->current_project_id]);

    $storage = $this->getMockBuilder(HetznerObjectStorage::class)
        ->setConstructorArgs(['test-access-key', 'test-secret-key', 'fsn1'])
        ->onlyMethods(['createBucket'])
        ->getMock();

    $storage->method('createBucket')->willThrowException(
        new S3Exception('Bucket already exists', new Command('CreateBucket'), ['code' => 'BucketAlreadyExists'])
    );

    $action = $this->getMockBuilder(CreateBucket::class)
        ->onlyMethods(['makeClient'])
        ->getMock();

    $action->method('makeClient')->willReturn($storage);

    try {
        $action->create($credential->project, [
            'name' => 'taken-name',
            'region' => 'fsn1',
            'visibility' => 'private',
        ]);
        $this->fail('Expected ValidationException was not thrown.');
    } catch (ValidationException $e) {
        expect($e->errors())->toHaveKey('name');
    }

    $this->assertDatabaseMissing('buckets', ['name' => 'taken-name']);
});

test('delete bucket connection removes the local record without touching hetzner', function () {
    $this->actingAs($this->user);

    $bucket = Bucket::factory()->create(['project_id' => $this->user->current_project_id]);

    $this->delete(route('buckets.destroy', $bucket))->assertRedirect();

    $this->assertDatabaseMissing('buckets', ['id' => $bucket->id]);
});

test('reveal returns the aws block for an authorized user', function () {
    $this->actingAs($this->user);

    $bucket = Bucket::factory()->create(['project_id' => $this->user->current_project_id]);

    $response = $this->get(route('buckets.reveal', $bucket))->assertOk();

    $response->assertJson([
        'AWS_ACCESS_KEY_ID' => $bucket->configuration['access_key'],
        'AWS_SECRET_ACCESS_KEY' => $bucket->configuration['secret_key'],
        'AWS_DEFAULT_REGION' => $bucket->configuration['region'],
        'AWS_BUCKET' => $bucket->configuration['bucket'],
        'AWS_ENDPOINT' => $bucket->configuration['endpoint'],
        'AWS_USE_PATH_STYLE_ENDPOINT' => 'false',
    ]);
});

test('reveal is forbidden for a project member without write access', function () {
    $this->actingAs($this->user);

    $bucket = Bucket::factory()->create(['project_id' => $this->user->current_project_id]);

    $this->user->currentProject->users()->where('user_id', $this->user->id)->update(['role' => UserRole::USER]);

    $this->get(route('buckets.reveal', $bucket))->assertForbidden();
});

test('connect site resource still injects the bucket copied credentials', function () {
    SSH::fake('');

    $this->actingAs($this->user);

    $bucket = Bucket::factory()->create([
        'project_id' => $this->user->current_project_id,
        'configuration' => [
            'endpoint' => 'https://fsn1.your-objectstorage.com',
            'region' => 'fsn1',
            'bucket' => 'app-uploads',
            'access_key' => 'app-access-key',
            'secret_key' => 'app-secret-key',
            'path_style' => false,
            'visibility' => 'private',
            'allowed_origins' => [],
        ],
    ]);

    $this->post(route('site-resources.store', ['server' => $this->server, 'site' => $this->site]), [
        'type' => 'bucket',
        'bucket_id' => $bucket->id,
    ])->assertRedirect();

    $resource = $this->site->resources()->where('type', 'bucket')->firstOrFail();

    expect($resource->environment)->toEqual([
        'FILESYSTEM_DISK' => 's3',
        'AWS_ACCESS_KEY_ID' => 'app-access-key',
        'AWS_SECRET_ACCESS_KEY' => 'app-secret-key',
        'AWS_DEFAULT_REGION' => 'fsn1',
        'AWS_BUCKET' => 'app-uploads',
        'AWS_ENDPOINT' => 'https://fsn1.your-objectstorage.com',
        'AWS_USE_PATH_STYLE_ENDPOINT' => 'false',
    ]);
});
