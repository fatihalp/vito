<?php

namespace App\StorageProviders;

use App\DTOs\DynamicField;
use App\Models\Server;
use App\Models\StorageProvider;
use App\SSH\Storage\S3 as S3Storage;
use App\SSH\Storage\Storage;
use Aws\S3\Exception\S3Exception;
use Aws\S3\S3Client;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

class S3 extends AbstractStorageProvider
{
    protected StorageProvider $storageProvider;

    protected ?S3Client $client = null;

    
    protected array $clientConfig = [];

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
                $url = 'https://' . $url;
            }

            return $url;
        }

        $region = $credentials['region'] ?? 'us-east-1';

        return "https://s3.{$region}.amazonaws.com";
    }

    public function getClient(): S3Client
    {
        return new S3Client($this->clientConfig);
    }

    public function buildClientConfig(?array $credentials = null): array
    {
        $credentials ??= $this->storageProvider->credentials;

        $this->clientConfig = [
            'credentials' => [
                'key' => trim($credentials['key']),
                'secret' => trim($credentials['secret']),
            ],
            'region' => trim($credentials['region'] ?? 'us-east-1'),
            'version' => 'latest',
            'endpoint' => $this->getApiUrl($credentials),
            'use_path_style_endpoint' => true,
        ];

        return $this->clientConfig;
    }

    public function validationRules(): array
    {
        return [
            'api_url' => 'nullable',
            'key' => 'required',
            'secret' => 'required',
            'region' => 'required',
            'bucket' => ['required', 'regex:/^\s*[A-Za-z0-9][A-Za-z0-9._-]{1,254}\s*$/'],
            'path' => 'nullable',
        ];
    }

    public function credentialData(array $input): array
    {
        $apiUrl = trim($input['api_url'] ?? '');
        if ($apiUrl !== '' && ! str_starts_with($apiUrl, 'http://') && ! str_starts_with($apiUrl, 'https://')) {
            $apiUrl = 'https://' . $apiUrl;
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
        try {
            $this->buildClientConfig($credentials);
            $this->probe($credentials);

            return true;
        } catch (Throwable $e) {
            $secrets = array_filter([$credentials['key'] ?? null, $credentials['secret'] ?? null], fn (?string $value): bool => (string) $value !== '');

            Log::error('Failed to connect to the provider', [
                'error' => str_replace([...$secrets, ...array_map(rawurlencode(...), $secrets)], '<redacted>', $e->getMessage()),
            ]);

            return false;
        }
    }

    public function canRead(array $credentials): bool
    {
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
            Log::error('Failed to verify read access to the provider', ['exception' => $e]);

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

        try {
            $client->putObject([
                'Bucket' => $bucket,
                'Key' => $key,
                'Body' => $body,
                'ContentMD5' => base64_encode(md5($body, true)),
            ]);

            try {
                $object = $client->getObject([
                    'Bucket' => $bucket,
                    'Key' => $key,
                ]);

                if ((string) $object['Body'] !== $body) {
                    throw new RuntimeException('The connection test object did not round-trip correctly.');
                }
            } catch (S3Exception $e) {
                if (! in_array($e->getAwsErrorCode(), ['AccessDenied', 'AllAccessDisabled'], true)) {
                    throw $e;
                }
            }
        } finally {
            try {
                $client->deleteObject([
                    'Bucket' => $bucket,
                    'Key' => $key,
                ]);
            } catch (Throwable) {

            }
        }
    }

    public function ssh(Server $server): Storage
    {
        return new S3Storage($server, $this->storageProvider);
    }
}
