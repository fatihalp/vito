<?php

namespace App\Actions\Bucket;

use App\Models\BucketCredential;
use App\Models\Project;
use App\Support\HetznerObjectStorage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;
use Throwable;

class ConnectBucketCredentials
{
    /**
     * @param  array<string, mixed>  $input
     *
     * @throws ValidationException
     */
    public function connect(Project $project, array $input): BucketCredential
    {
        $data = Validator::make($input, [
            'access_key' => ['required', 'string', 'max:1024'],
            'secret_key' => ['required', 'string', 'max:4096'],
        ])->validate();

        if (! $this->verify($data['access_key'], $data['secret_key'])) {
            throw ValidationException::withMessages([
                'access_key' => __("Couldn't connect to Hetzner Object Storage with these credentials."),
            ]);
        }

        return BucketCredential::query()->updateOrCreate(
            ['project_id' => $project->id],
            ['credentials' => ['access_key' => $data['access_key'], 'secret_key' => $data['secret_key']]],
        );
    }

    protected function makeClient(string $accessKey, string $secretKey, string $region): HetznerObjectStorage
    {
        return new HetznerObjectStorage($accessKey, $secretKey, $region);
    }

    private function verify(string $accessKey, string $secretKey): bool
    {
        try {
            return $this->makeClient($accessKey, $secretKey, (string) config('hetzner-object-storage.default_region'))->connect();
        } catch (Throwable $e) {
            Log::error('Failed to verify Hetzner Object Storage credentials', ['exception' => get_class($e)]);

            return false;
        }
    }
}
