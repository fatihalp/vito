<?php

namespace App\Actions\StorageProvider;

use App\Models\StorageProvider;
use App\Models\StorageMigration;
use App\StorageProviders\Dropbox;
use Illuminate\Validation\ValidationException;

class DeleteStorageProvider
{
    public function delete(StorageProvider $storageProvider): void
    {
        if (StorageMigration::query()->where(function ($query) use ($storageProvider): void {
            $query->where('source_storage_id', $storageProvider->id)
                ->orWhere('target_storage_id', $storageProvider->id);
        })->exists()) {
            throw ValidationException::withMessages([
                'provider' => 'This storage provider is referenced by a storage migration. Resolve and remove the migration before deleting the provider.',
            ]);
        }

        if ($storageProvider->backups()->exists()) {
            throw ValidationException::withMessages([
                'provider' => __('This storage provider is being used by a backup.'),
            ]);
        }

        if ($storageProvider->siteResources()->exists()) {
            throw ValidationException::withMessages([
                'provider' => __('This storage provider is currently connected to a site.'),
            ]);
        }

        if ($storageProvider->provider === Dropbox::id()) {
            $provider = $storageProvider->provider();
            assert($provider instanceof Dropbox);
            $provider->forgetAccessToken();
        }

        $storageProvider->delete();
    }
}
