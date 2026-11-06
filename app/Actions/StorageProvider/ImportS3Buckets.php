<?php

namespace App\Actions\StorageProvider;

use App\Models\StorageProvider;
use App\Models\User;
use App\StorageProviders\S3;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class ImportS3Buckets
{
    public function availableBuckets(array $input): array
    {
        $credentials = $this->credentials($input);
        $provider = new S3(new StorageProvider(['provider' => S3::id()]));

        return $this->listBuckets($provider, $credentials);
    }

    public function import(User $user, array $input, ?int $projectId): array
    {
        $credentials = $this->credentials($input);
        $buckets = Validator::make($input, [
            'buckets' => ['required', 'array', 'min:1'],
            'buckets.*' => ['required', 'string', 'distinct', 'regex:/^[A-Za-z0-9][A-Za-z0-9._-]{1,254}$/'],
        ])->validate()['buckets'];

        $provider = new S3(new StorageProvider(['provider' => S3::id()]));
        $availableBuckets = $this->listBuckets($provider, $credentials);
        $unknownBuckets = array_values(array_diff($buckets, $availableBuckets));

        if ($unknownBuckets !== []) {
            throw ValidationException::withMessages([
                'buckets' => __('One or more selected buckets are not available to this token.'),
            ]);
        }

        $endpoint = $provider->getApiUrl($credentials);
        $existingBuckets = StorageProvider::query()
            ->where('user_id', $user->id)
            ->where('provider', S3::id())
            ->when($projectId === null, fn ($query) => $query->whereNull('project_id'), fn ($query) => $query->where('project_id', $projectId))
            ->select(['id', 'provider', 'credentials'])
            ->cursor()
            ->filter(fn (StorageProvider $storageProvider): bool => $storageProvider->provider()->getApiUrl() === $endpoint
            )
            ->map(fn (StorageProvider $storageProvider) => $storageProvider->credentials['bucket'] ?? null)
            ->filter(fn (mixed $bucket): bool => is_string($bucket))
            ->all();

        $toCreate = array_values(array_diff($buckets, $existingBuckets));
        $storageProviders = [];

        foreach ($toCreate as $bucket) {
            $storageProvider = new StorageProvider([
                'user_id' => $user->id,
                'provider' => S3::id(),
                'profile' => Str::limit(trim($input['name']).' / '.$bucket, 255, ''),
                'project_id' => $projectId,
            ]);
            $storageProvider->credentials = [...$credentials, 'bucket' => $bucket];

            app(VerifyStorageConnection::class)->verify($storageProvider->provider(), $storageProvider->credentials);

            $storageProviders[] = $storageProvider;
        }

        DB::transaction(fn () => collect($storageProviders)->each->save());

        return [
            'created' => array_map(fn (StorageProvider $storageProvider) => $storageProvider->profile, $storageProviders),
            'skipped' => array_values(array_intersect($buckets, $existingBuckets)),
        ];
    }

    private function listBuckets(S3 $provider, array $credentials): array
    {
        try {
            return $provider->listBuckets($credentials);
        } catch (RuntimeException) {
            throw ValidationException::withMessages([
                'provider' => $provider->connectionError() ?? __('Couldn\'t connect to the provider.'),
            ]);
        }
    }

    private function credentials(array $input): array
    {
        $data = Validator::make($input, [
            'name' => ['required', 'string', 'max:240'],
            'api_url' => ['nullable', 'string', 'max:2048'],
            'key' => ['required', 'string', 'max:255'],
            'secret' => ['required', 'string', 'max:1000'],
            'region' => ['required', 'string', 'max:255'],
            'path' => ['nullable', 'string', 'max:1024'],
        ])->validate();

        return (new S3(new StorageProvider(['provider' => S3::id()])))->credentialData([
            ...$data,
            'bucket' => 'placeholder-bucket',
        ]);
    }
}
