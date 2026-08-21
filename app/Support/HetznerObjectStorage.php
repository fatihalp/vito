<?php

namespace App\Support;

use Aws\S3\Exception\S3Exception;
use Aws\S3\S3Client;
use Illuminate\Support\Facades\Log;

class HetznerObjectStorage
{
    public const string DOMAIN_SUFFIX = 'your-objectstorage.com';

    public function __construct(
        protected string $accessKey,
        protected string $secretKey,
        protected string $region,
    ) {}

    public static function endpointFor(string $region): string
    {
        return "https://{$region}.".self::DOMAIN_SUFFIX;
    }

    public static function publicUrlFor(string $bucket, string $region): string
    {
        return "https://{$bucket}.{$region}.".self::DOMAIN_SUFFIX;
    }

    public function getClient(): S3Client
    {
        return new S3Client($this->buildClientConfig());
    }

    
    public function buildClientConfig(): array
    {
        return [
            'credentials' => [
                'key' => $this->accessKey,
                'secret' => $this->secretKey,
            ],
            'region' => $this->region,
            'version' => 'latest',
            'endpoint' => self::endpointFor($this->region),
        ];
    }

    public function connect(): bool
    {
        try {
            $this->getClient()->listBuckets();

            return true;
        } catch (S3Exception $e) {
            Log::error('Failed to connect to Hetzner Object Storage', ['exception' => $e]);

            return false;
        }
    }

    
    public function createBucket(string $name): void
    {
        $this->getClient()->createBucket(['Bucket' => $name]);
    }

    
    public function putBucketAcl(string $name, string $visibility): void
    {
        $this->getClient()->putBucketAcl([
            'Bucket' => $name,
            'ACL' => $visibility === 'public' ? 'public-read' : 'private',
        ]);
    }

    
    public function putBucketCors(string $name, array $allowedOrigins): void
    {
        $this->getClient()->putBucketCors([
            'Bucket' => $name,
            'CORSConfiguration' => [
                'CORSRules' => [[
                    'AllowedOrigins' => $allowedOrigins,
                    'AllowedMethods' => ['GET', 'HEAD'],
                    'AllowedHeaders' => ['*'],
                ]],
            ],
        ]);
    }
}
