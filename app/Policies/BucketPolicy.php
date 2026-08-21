<?php

namespace App\Policies;

use App\Models\Bucket;
use App\Models\PersonalAccessToken;
use App\Models\Project;
use App\Models\User;
use App\Traits\HasRolePolicies;
use Laravel\Sanctum\TransientToken;

class BucketPolicy
{
    use HasRolePolicies;

    public function viewAny(User $user, Project $project): bool
    {
        return $this->hasReadAccess($user, $project);
    }

    public function view(User $user, Bucket $bucket): bool
    {
        return $this->hasReadAccess($user, $bucket->project);
    }

    public function create(User $user, Project $project): bool
    {
        return $this->hasWriteAccess($user, $project);
    }

    public function delete(User $user, Bucket $bucket): bool
    {
        return $this->hasWriteAccess($user, $bucket->project);
    }

    public function manageCredentials(User $user, Project $project): bool
    {
        return $this->hasWriteAccess($user, $project);
    }

    
    public function revealCredentials(User $user, Bucket $bucket): bool
    {
        
        $token = $user->currentAccessToken();

        if ($token !== null && ! $token->can('write')) {
            return false;
        }

        return $this->hasWriteAccess($user, $bucket->project);
    }
}
