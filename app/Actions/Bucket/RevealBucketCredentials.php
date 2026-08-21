<?php

namespace App\Actions\Bucket;

use App\Models\Bucket;
use App\Support\HetznerObjectStorage;

class RevealBucketCredentials
{
    
    public function reveal(Bucket $bucket): array
    {
        $config = $bucket->configuration;

        return [
            'AWS_ACCESS_KEY_ID' => (string) $config['access_key'],
            'AWS_SECRET_ACCESS_KEY' => (string) $config['secret_key'],
            'AWS_DEFAULT_REGION' => (string) $config['region'],
            'AWS_BUCKET' => (string) $config['bucket'],
            'AWS_ENDPOINT' => (string) $config['endpoint'],
            'AWS_URL' => HetznerObjectStorage::publicUrlFor((string) $config['bucket'], (string) $config['region']),
            'AWS_USE_PATH_STYLE_ENDPOINT' => ($config['path_style'] ?? false) ? 'true' : 'false',
        ];
    }
}
