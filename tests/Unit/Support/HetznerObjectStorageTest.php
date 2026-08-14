<?php

use App\Support\HetznerObjectStorage;
use Aws\Command;
use Aws\S3\Exception\S3Exception;
use Aws\S3\S3Client;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('endpoint for builds the region scoped url', function () {
    expect(HetznerObjectStorage::endpointFor('fsn1'))->toBe('https://fsn1.your-objectstorage.com');
});

test('public url for builds the virtual hosted style url', function () {
    expect(HetznerObjectStorage::publicUrlFor('my-bucket', 'fsn1'))->toBe('https://my-bucket.fsn1.your-objectstorage.com');
});

test('connect returns true when hetzner accepts the credentials', function () {
    $s3ClientMock = $this->getMockBuilder(S3Client::class)
        ->disableOriginalConstructor()
        ->onlyMethods(['getCommand', 'execute'])
        ->getMock();

    $s3ClientMock->expects($this->once())
        ->method('getCommand')
        ->with('listBuckets')
        ->willReturn(new Command('listBuckets'));

    $s3ClientMock->expects($this->once())
        ->method('execute')
        ->willReturn(['Buckets' => []]);

    $storage = $this->getMockBuilder(HetznerObjectStorage::class)
        ->setConstructorArgs(['fake-key', 'fake-secret', 'fsn1'])
        ->onlyMethods(['getClient'])
        ->getMock();

    $storage->expects($this->once())->method('getClient')->willReturn($s3ClientMock);

    expect($storage->connect())->toBeTrue();
});

test('connect returns false when hetzner rejects the credentials', function () {
    $s3ClientMock = $this->getMockBuilder(S3Client::class)
        ->disableOriginalConstructor()
        ->onlyMethods(['getCommand', 'execute'])
        ->getMock();

    $s3ClientMock->expects($this->once())
        ->method('getCommand')
        ->with('listBuckets')
        ->willReturn(new Command('listBuckets'));

    $s3ClientMock->expects($this->once())
        ->method('execute')
        ->willThrowException(new S3Exception('Error', new Command('ListBuckets')));

    $storage = $this->getMockBuilder(HetznerObjectStorage::class)
        ->setConstructorArgs(['fake-key', 'fake-secret', 'fsn1'])
        ->onlyMethods(['getClient'])
        ->getMock();

    $storage->expects($this->once())->method('getClient')->willReturn($s3ClientMock);

    expect($storage->connect())->toBeFalse();
});

test('create bucket calls the client with the bucket name', function () {
    $s3ClientMock = $this->getMockBuilder(S3Client::class)
        ->disableOriginalConstructor()
        ->onlyMethods(['getCommand', 'execute'])
        ->getMock();

    $s3ClientMock->expects($this->once())
        ->method('getCommand')
        ->with('createBucket', ['Bucket' => 'my-bucket'])
        ->willReturn(new Command('createBucket'));

    $s3ClientMock->expects($this->once())->method('execute')->willReturn([]);

    $storage = $this->getMockBuilder(HetznerObjectStorage::class)
        ->setConstructorArgs(['fake-key', 'fake-secret', 'fsn1'])
        ->onlyMethods(['getClient'])
        ->getMock();

    $storage->expects($this->once())->method('getClient')->willReturn($s3ClientMock);

    $storage->createBucket('my-bucket');
});

test('create bucket lets a name conflict exception bubble up', function () {
    $s3ClientMock = $this->getMockBuilder(S3Client::class)
        ->disableOriginalConstructor()
        ->onlyMethods(['getCommand', 'execute'])
        ->getMock();

    $s3ClientMock->method('getCommand')->willReturn(new Command('createBucket'));
    $s3ClientMock->method('execute')->willThrowException(
        new S3Exception('Bucket already exists', new Command('CreateBucket'), ['code' => 'BucketAlreadyExists'])
    );

    $storage = $this->getMockBuilder(HetznerObjectStorage::class)
        ->setConstructorArgs(['fake-key', 'fake-secret', 'fsn1'])
        ->onlyMethods(['getClient'])
        ->getMock();

    $storage->method('getClient')->willReturn($s3ClientMock);

    try {
        $storage->createBucket('my-bucket');
        $this->fail('Expected S3Exception was not thrown.');
    } catch (S3Exception $e) {
        expect($e->getAwsErrorCode())->toBe('BucketAlreadyExists');
    }
});

test('put bucket acl maps public visibility to the public read canned acl', function () {
    $s3ClientMock = $this->getMockBuilder(S3Client::class)
        ->disableOriginalConstructor()
        ->onlyMethods(['getCommand', 'execute'])
        ->getMock();

    $s3ClientMock->expects($this->once())
        ->method('getCommand')
        ->with('putBucketAcl', ['Bucket' => 'my-bucket', 'ACL' => 'public-read'])
        ->willReturn(new Command('putBucketAcl'));

    $s3ClientMock->expects($this->once())->method('execute')->willReturn([]);

    $storage = $this->getMockBuilder(HetznerObjectStorage::class)
        ->setConstructorArgs(['fake-key', 'fake-secret', 'fsn1'])
        ->onlyMethods(['getClient'])
        ->getMock();

    $storage->expects($this->once())->method('getClient')->willReturn($s3ClientMock);

    $storage->putBucketAcl('my-bucket', 'public');
});

test('put bucket acl maps private visibility to the private canned acl', function () {
    $s3ClientMock = $this->getMockBuilder(S3Client::class)
        ->disableOriginalConstructor()
        ->onlyMethods(['getCommand', 'execute'])
        ->getMock();

    $s3ClientMock->expects($this->once())
        ->method('getCommand')
        ->with('putBucketAcl', ['Bucket' => 'my-bucket', 'ACL' => 'private'])
        ->willReturn(new Command('putBucketAcl'));

    $s3ClientMock->expects($this->once())->method('execute')->willReturn([]);

    $storage = $this->getMockBuilder(HetznerObjectStorage::class)
        ->setConstructorArgs(['fake-key', 'fake-secret', 'fsn1'])
        ->onlyMethods(['getClient'])
        ->getMock();

    $storage->expects($this->once())->method('getClient')->willReturn($s3ClientMock);

    $storage->putBucketAcl('my-bucket', 'private');
});

test('put bucket cors sends the allowed origins', function () {
    $s3ClientMock = $this->getMockBuilder(S3Client::class)
        ->disableOriginalConstructor()
        ->onlyMethods(['getCommand', 'execute'])
        ->getMock();

    $s3ClientMock->expects($this->once())
        ->method('getCommand')
        ->with('putBucketCors', [
            'Bucket' => 'my-bucket',
            'CORSConfiguration' => [
                'CORSRules' => [[
                    'AllowedOrigins' => ['https://example.com'],
                    'AllowedMethods' => ['GET', 'HEAD'],
                    'AllowedHeaders' => ['*'],
                ]],
            ],
        ])
        ->willReturn(new Command('putBucketCors'));

    $s3ClientMock->expects($this->once())->method('execute')->willReturn([]);

    $storage = $this->getMockBuilder(HetznerObjectStorage::class)
        ->setConstructorArgs(['fake-key', 'fake-secret', 'fsn1'])
        ->onlyMethods(['getClient'])
        ->getMock();

    $storage->expects($this->once())->method('getClient')->willReturn($s3ClientMock);

    $storage->putBucketCors('my-bucket', ['https://example.com']);
});
