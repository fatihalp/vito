<?php

namespace App\Contracts\Actions\StorageProvider;

use App\Models\StorageProvider;

interface DeleteStorageProvider
{
    public function delete(StorageProvider $storageProvider): void;
}
