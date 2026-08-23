<?php

namespace App\Actions\StorageProvider;

use App\Models\StorageProvider;
use App\StorageProviders\Dropbox;
use Illuminate\Validation\ValidationException;

class DeleteStorageProvider
{
    public function delete(StorageProvider $storageProvider): void
    {
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
