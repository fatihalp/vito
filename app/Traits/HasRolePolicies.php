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

    /**
     * Writing to the server that hosts Vito itself is reserved for panel admins, since a cron job or SSH key there is root on the panel.
     */
    protected function hasServerWriteAccess(User $user, Server $server): bool
    {
        return $this->hasWriteAccess($user, $server->project) && (! $server->is_self || $user->isAdmin());
    }

    protected function hasReadAccess(User $user, ?Project $project): bool
    {
        if (! $project || ! $user->tokenAllowsProject($project->id)) {
            return false;
        }

        if ($user->isAdmin()) {
            return true;
        }

        return $project->hasRoles($user, [
            UserRole::OWNER,
            UserRole::ADMIN,
            UserRole::USER,
        ]);
    }

    protected function hasWriteAccess(User $user, ?Project $project): bool
    {
        if (! $project || ! $user->tokenAllowsProject($project->id, write: true)) {
            return false;
        }

        if ($user->isAdmin()) {
            return true;
        }

        return $project->hasRoles($user, [
            UserRole::OWNER,
            UserRole::ADMIN,
            UserRole::USER,
        ]);
    }

    protected function hasOwnerAccess(User $user, ?Project $project): bool
    {
        if (! $project || ! $user->tokenAllowsProject($project->id, write: true)) {
            return false;
        }

        if ($user->isAdmin()) {
            return true;
        }

        return $project->hasRoles($user, [
            UserRole::OWNER,
        ]);
    }
}
