<?php

namespace App\Traits;

use App\Enums\UserRole;
use App\Enums\ServerStatus;
use App\Models\Project;
use App\Models\Server;
use App\Models\User;

trait HasRolePolicies
{
    protected function hasServerReadAccess(User $user, Server $server): bool
    {
        return $this->hasReadAccess($user, $server->project)
            && ($server->isReady() || $server->status === ServerStatus::DISCONNECTED);
    }

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
