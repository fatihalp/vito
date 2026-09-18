<?php

namespace App\Policies;

use App\Models\Project;
use App\Models\StorageMigration;
use App\Models\User;
use App\Traits\HasRolePolicies;
use Illuminate\Auth\Access\HandlesAuthorization;

class StorageMigrationPolicy
{
    use HandlesAuthorization;
    use HasRolePolicies;

    public function manageSettings(User $user): bool
    {
        return $user->isAdmin();
    }

    public function preview(User $user, StorageMigration $storageMigration): bool
    {
        return $user->isAdmin() && $this->view($user, $storageMigration);
    }

    public function viewAny(User $user, Project $project): bool
    {
        return $this->hasReadAccess($user, $project);
    }

    public function view(User $user, StorageMigration $storageMigration): bool
    {
        return $this->hasReadAccess($user, $storageMigration->project);
    }

    public function create(User $user, Project $project): bool
    {
        return $this->hasWriteAccess($user, $project);
    }

    public function update(User $user, StorageMigration $storageMigration): bool
    {
        return $this->hasWriteAccess($user, $storageMigration->project);
    }

    public function delete(User $user, StorageMigration $storageMigration): bool
    {
        return $this->hasWriteAccess($user, $storageMigration->project)
            && $storageMigration->isSettled();
    }
}
