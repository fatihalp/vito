<?php

namespace App\StorageProviders;

use App\DTOs\DynamicField;
use App\Models\Server;
use App\Models\StorageProvider;
use App\SSH\Storage\S3 as S3Storage;
use App\SSH\Storage\Storage;
use Aws\S3\S3Client;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class S3 extends AbstractStorageProvider implements ReportsConnectionErrors
{
    protected StorageProvider $storageProvider;

    protected ?S3Client $client = null;

    protected array $clientConfig = [];

    protected ?string $lastConnectionError = null;

    public static function id(): string
    {
        return 's3';
    }

    public function getApiUrl(?array $credentials = null): string
    {
        $credentials ??= $this->storageProvider->credentials;

        if (isset($credentials['api_url']) && trim($credentials['api_url']) !== '') {
            $url = trim($credentials['api_url']);
            if (! str_starts_with($url, 'http://') && ! str_starts_with($url, 'https://')) {
                $url = 'https://'.$url;
            }

            return rtrim($url, '/');
        }

        $region = $credentials['region'] ?? 'us-east-1';

        return "https://s3.{$region}.amazonaws.com";
    }

    public function getClient(): S3Client
    {
        return $this->client ??= new S3Client($this->clientConfig);
    }

    public function forgetCachedState(): void
    {
        $this->client = null;
        $this->clientConfig = [];
        $this->lastConnectionError = null;
    }

    public function buildClientConfig(?array $credentials = null): array
    {
        $credentials ??= $this->storageProvider->credentials;

        $config = [
            'credentials' => [
                'key' => trim($credentials['key']),
                'secret' => trim($credentials['secret']),
            ],
            'region' => trim($credentials['region'] ?? 'us-east-1'),
            'version' => 'latest',
            'endpoint' => $this->getApiUrl($credentials),
            'use_path_style_endpoint' => true,
            'http' => ['connect_timeout' => 5, 'timeout' => 30],
            'retries' => 2,
        ];

        if ($config !== $this->clientConfig) {
            $this->client = null;
            $this->clientConfig = $config;
        }

        return $this->clientConfig;
    }

    public function validationRules(): array
    {
        return [
            'api_url' => ['nullable', 'string', 'max:2048'],
            'key' => ['required', 'string', 'max:255'],
            'secret' => ['required', 'string', 'max:1000'],
            'region' => ['required', 'string', 'max:255'],
            'bucket' => ['required', 'string', 'regex:/^\s*[A-Za-z0-9][A-Za-z0-9._-]{1,254}\s*$/'],
            'path' => ['nullable', 'string', 'max:1024'],
        ];
    }

    public function credentialData(array $input): array
    {
        $apiUrl = trim($input['api_url'] ?? '');
        if ($apiUrl !== '' && ! str_starts_with($apiUrl, 'http://') && ! str_starts_with($apiUrl, 'https://')) {
            $apiUrl = 'https://'.$apiUrl;
        }

        return [
            'api_url' => $apiUrl,
            'key' => trim($input['key']),
            'secret' => trim($input['secret']),
            'region' => trim($input['region']),
            'bucket' => trim($input['bucket']),
            'path' => trim($input['path'] ?? ''),
        ];
    }

    public static function editFields(): array
    {
        return [
            DynamicField::make('api_url')
                ->text()
                ->label('API URL'),
            DynamicField::make('key')
                ->text()
                ->label('Access Key'),
            DynamicField::make('secret')
                ->passwordWithToggle()
                ->label('Secret Key')
                ->description('Leave empty to keep the current secret key'),
            DynamicField::make('region')
                ->text()
                ->label('Region'),
            DynamicField::make('bucket')
                ->text()
                ->label('Bucket Name'),
            DynamicField::make('path')
                ->text()
                ->label('Path'),
        ];
    }

    protected function editableFields(): array
    {
        return ['api_url', 'key', 'region', 'bucket', 'path'];
    }

    protected function secretFields(): array
    {
        return ['secret'];
    }

    public function connect(array $credentials): bool
    {
        $this->lastConnectionError = null;

        try {
            $this->buildClientConfig($credentials);
            $this->probe($credentials);

            return true;
        } catch (Throwable $e) {
            $this->recordConnectionError($e, 'Failed to connect to the provider');

            return false;
        }
    }

    public function listBuckets(array $credentials): array
    {
        $this->lastConnectionError = null;

        try {
            $this->buildClientConfig($credentials);
            $names = [];

            foreach ($this->getClient()->getPaginator('ListBuckets') as $page) {
                foreach ($page->get('Buckets') ?? [] as $bucket) {
                    $name = $bucket['Name'] ?? null;

                    if (is_string($name) && $name !== '') {
                        $names[] = $name;
                    }
                }
            }

            sort($names, SORT_NATURAL | SORT_FLAG_CASE);

            return array_values(array_unique($names));
        } catch (Throwable $e) {
            $this->recordConnectionError($e, 'Failed to list S3 buckets');

            throw new RuntimeException($this->lastConnectionError, previous: $e);
        }
    }

    public function connectionError(): ?string
    {
        return $this->lastConnectionError;
    }

    public static function connectionErrorMessage(Throwable $e): string
    {
        $code = method_exists($e, 'getAwsErrorCode') ? $e->getAwsErrorCode() : null;

        return match ($code) {
            'NoSuchBucket' => __('Bucket not found. Check the bucket name.'),
            'AccessDenied', 'AllAccessDisabled' => __('Access was denied. Check the storage token permissions.'),
            'InvalidAccessKeyId', 'SignatureDoesNotMatch', 'InvalidToken', 'ExpiredToken' => __('The access key or secret key is invalid.'),
            default => __('Couldn\'t connect to the provider.'),
        };
    }

    public function canRead(array $credentials): bool
    {
        $this->lastConnectionError = null;

        try {
            $this->buildClientConfig($credentials);
            $client = $this->getClient();
            $bucket = trim((string) $credentials['bucket']);
            $prefix = trim((string) ($credentials['path'] ?? ''), '/');

            $client->listObjectsV2(array_filter([
                'Bucket' => $bucket,
                'Prefix' => $prefix !== '' ? $prefix.'/' : null,
                'MaxKeys' => 1,
            ], fn ($value) => $value !== null));

            return true;
        } catch (Throwable $e) {
            $this->recordConnectionError($e, 'Failed to verify read access to the provider');

            return false;
        }
    }

    public function presignedUrl(array $credentials, string $key, string $expiry = '+15 minutes', array $parameters = []): string
    {
        $this->buildClientConfig($credentials);
        $client = $this->getClient();

        $command = $client->getCommand('GetObject', [
            ...$parameters,
            'Bucket' => trim((string) $credentials['bucket']),
            'Key' => $key,
        ]);

        return (string) $client->createPresignedRequest($command, $expiry)->getUri();
    }

    private function probe(array $credentials): void
    {
        $client = $this->getClient();
        $bucket = trim((string) $credentials['bucket']);
        $prefix = trim((string) ($credentials['path'] ?? ''), '/');
        $key = ($prefix !== '' ? $prefix.'/' : '').'.vito-connection-test-'.Str::random(8);
        $body = 'vito-connection-test-'.Str::random(8);
        $written = false;
        $failure = null;

        try {
            $client->putObject([
                'Bucket' => $bucket,
                'Key' => $key,
                'Body' => $body,
            ]);
            $written = true;

            $object = $client->getObject([
                'Bucket' => $bucket,
                'Key' => $key,
            ]);

            if ((string) $object['Body'] !== $body) {
                throw new RuntimeException('The connection test object did not round-trip correctly.');
            }
        } catch (Throwable $e) {
            $failure = $e;
        }

        if ($written) {
            try {
                $client->deleteObject([
                    'Bucket' => $bucket,
                    'Key' => $key,
                ]);
            } catch (Throwable $e) {
                $failure ??= $e;
            }
        }

        if ($failure) {
            throw $failure;
        }
    }

    private function recordConnectionError(Throwable $e, string $message): void
    {
        $this->lastConnectionError = static::connectionErrorMessage($e);

        Log::error($message, [
            'exception' => get_class($e),
            'code' => method_exists($e, 'getAwsErrorCode') ? $e->getAwsErrorCode() : null,
        ]);
    }

    public function ssh(Server $server): Storage
    {
        return new S3Storage($server, $this->storageProvider);
    }
}
