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
            'bucket' => 'required',
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
            $this->getClient()->listBuckets();

            return true;
        } catch (S3Exception $e) {
            Log::error('Failed to connect to the provider', ['exception' => $e]);

            return false;
        }
    }

    public function ssh(Server $server): Storage
    {
        return new S3Storage($server, $this->storageProvider);
    }
}
