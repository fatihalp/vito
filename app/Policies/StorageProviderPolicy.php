<?php

namespace App\Policies;

use App\Models\PersonalAccessToken;
use App\Models\StorageProvider;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;
use Laravel\Sanctum\TransientToken;

class StorageProviderPolicy
{
    use HandlesAuthorization;

    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, StorageProvider $storageProvider): bool
    {
        return $user->id === $storageProvider->user_id;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, StorageProvider $storageProvider): bool
    {
        return $user->id === $storageProvider->user_id;
    }

    
    public function revealCredentials(User $user, StorageProvider $storageProvider): bool
    {
        
        $token = $user->currentAccessToken();

        if ($token !== null && ! $token->can('write')) {
            return false;
        }

        return $this->update($user, $storageProvider);
    }

    public function delete(User $user, StorageProvider $storageProvider): bool
    {
        return $user->id === $storageProvider->user_id;
    }
}
