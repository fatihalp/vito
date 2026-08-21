<?php

namespace App\Actions\Bucket;

use App\Models\Bucket;
use App\Models\Project;
use App\Support\HetznerObjectStorage;
use Aws\S3\Exception\S3Exception;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CreateBucket
{
    
    public function create(Project $project, array $input): Bucket
    {
        $data = Validator::make($input, [
            'name' => [
                'required',
                'string',
                'min:3',
                'max:63',
                'regex:/^[a-z0-9][a-z0-9\-]*[a-z0-9]$/',
                Rule::unique('buckets')->where('project_id', $project->id),
            ],
            'region' => ['required', 'string', Rule::in(array_keys(config('hetzner-object-storage.regions')))],
            'visibility' => ['required', 'string', Rule::in(['private', 'public'])],
            'allowed_origins' => ['sometimes', 'array', 'max:20'],
            'allowed_origins.*' => ['string', 'max:2048'],
        ])->validate();

        $credential = $project->bucketCredential;

        if (! $credential) {
            throw ValidationException::withMessages([
                'name' => __('Connect your Hetzner Object Storage credentials first.'),
                'bucket_name' => __('Connect your Hetzner Object Storage credentials first.'),
            ]);
        }

        $client = $this->makeClient(
            (string) $credential->credentials['access_key'],
            (string) $credential->credentials['secret_key'],
            $data['region'],
        );

        try {
            $client->createBucket($data['name']);
            $client->putBucketAcl($data['name'], $data['visibility']);

            if (! empty($data['allowed_origins'])) {
                $client->putBucketCors($data['name'], $data['allowed_origins']);
            }
        } catch (S3Exception $e) {
            Log::error('Failed to create Hetzner bucket', [
                'bucket' => $data['name'],
                'project_id' => $project->id,
                'aws_error_code' => $e->getAwsErrorCode(),
            ]);

            $message = $this->friendlyMessage($e);

            throw ValidationException::withMessages([
                'name' => $message,
                'bucket_name' => $message,
            ]);
        }

        return $project->buckets()->create([
            'name' => $data['name'],
            'driver' => 's3',
            'configuration' => [
                'endpoint' => HetznerObjectStorage::endpointFor($data['region']),
                'region' => $data['region'],
                'bucket' => $data['name'],
                'access_key' => $credential->credentials['access_key'],
                'secret_key' => $credential->credentials['secret_key'],
                'path_style' => false,
                'visibility' => $data['visibility'],
                'allowed_origins' => $data['allowed_origins'] ?? [],
            ],
        ]);
    }

    protected function makeClient(string $accessKey, string $secretKey, string $region): HetznerObjectStorage
    {
        return new HetznerObjectStorage($accessKey, $secretKey, $region);
    }

    private function friendlyMessage(S3Exception $e): string
    {
        if (in_array($e->getAwsErrorCode(), ['BucketAlreadyExists', 'BucketAlreadyOwnedByYou'], true)) {
            return __('This bucket name is already taken. Hetzner bucket names are globally unique across all customers — try a different name.');
        }

        return __('Failed to create the bucket on Hetzner. Please try again.');
    }
}
