<?php

namespace App\Traits;

use App\Enums\UserRole;
use App\Models\Project;
use App\Models\User;

trait HasRolePolicies
{
    protected function hasReadAccess(User $user, Project $project): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        return $project->hasRoles($user, [
            UserRole::OWNER,
            UserRole::ADMIN,
            UserRole::USER,
        ]);
    }

    protected function hasWriteAccess(User $user, Project $project): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        return $project->hasRoles($user, [
            UserRole::OWNER,
            UserRole::ADMIN,
            UserRole::USER,
        ]);
    }

    protected function hasOwnerAccess(User $user, Project $project): bool
    {
        if ($user->isAdmin()) {
            return true;
        }

        return $project->hasRoles($user, [
            UserRole::OWNER,
        ]);
    }
}
