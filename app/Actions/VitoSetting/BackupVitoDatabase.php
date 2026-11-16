<?php

namespace App\Actions\VitoSetting;

use App\Models\StorageProvider;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class BackupVitoDatabase
{
    public function backup(User $user, array $input): string
    {
        $data = Validator::make($input, [
            'storage_provider_id' => [
                'required',
                Rule::exists('storage_providers', 'id')->where('provider', 's3')->whereNull('deleted_at'),
            ],
        ])->validate();

        $storage = StorageProvider::query()->findOrFail($data['storage_provider_id']);
        Gate::forUser($user)->authorize('view', $storage);

        $snapshot = tempnam(sys_get_temp_dir(), 'vito-db-');
        unlink($snapshot);

        try {
            DB::statement('VACUUM INTO ?', [$snapshot]);

            return $this->upload($storage, $snapshot);
        } finally {
            @unlink($snapshot);
        }
    }

    private function upload(StorageProvider $storage, string $snapshot): string
    {
        $provider = $storage->provider();
        $provider->buildClientConfig();

        $path = trim($storage->credentials['path'] ?? '', '/');
        $key = ltrim($path.'/vito-database-'.now()->format('Y-m-d-His').'.sqlite', '/');

        $provider->getClient()->putObject([
            'Bucket' => trim($storage->credentials['bucket']),
            'Key' => $key,
            'SourceFile' => $snapshot,
        ]);

        return $key;
    }
}
