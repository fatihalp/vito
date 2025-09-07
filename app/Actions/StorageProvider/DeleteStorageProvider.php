<?php

namespace App\Actions\StorageProvider;

use App\Contracts\Actions\StorageProvider\DeleteStorageProvider as DeleteStorageProviderContract;
use App\Models\StorageProvider;
use Illuminate\Validation\ValidationException;

class DeleteStorageProvider implements DeleteStorageProviderContract
{
    public function delete(StorageProvider $storageProvider): void
    {
        if ($storageProvider->backups()->exists()) {
            throw ValidationException::withMessages([
                'provider' => __('This storage provider is being used by a backup.'),
            ]);
        }

        $storageProvider->delete();
    }
}
