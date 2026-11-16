<?php

namespace App\Actions\VitoSetting;

use App\Models\StorageProvider;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

class ListBackupStorageProviders
{
    public function list(User $user): Collection
    {
        return StorageProvider::query()
            ->where('provider', 's3')
            ->where('user_id', $user->id)
            ->get(['id', 'profile']);
    }
}
