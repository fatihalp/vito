<?php

namespace App\Policies;

use App\Models\DatabaseUpgrade;
use App\Models\Server;
use App\Models\User;
use App\Traits\HasRolePolicies;
use Illuminate\Auth\Access\HandlesAuthorization;

class DatabaseUpgradePolicy
{
    use HandlesAuthorization;
    use HasRolePolicies;

    public function viewAny(User $user, Server $server): bool
    {
        return $this->hasServerReadAccess($user, $server);
    }

    public function view(User $user, DatabaseUpgrade $upgrade): bool
    {
        return $this->hasServerReadAccess($user, $upgrade->source);
    }

    public function create(User $user, Server $server): bool
    {
        return $this->hasWriteAccess($user, $server->project) && $server->isReady();
    }

    /**
     * Switching over makes the old server read-only, so only an owner may do it.
     */
    public function finish(User $user, DatabaseUpgrade $upgrade): bool
    {
        return $this->hasOwnerAccess($user, $upgrade->source->project);
    }

    public function update(User $user, DatabaseUpgrade $upgrade): bool
    {
        return $this->hasWriteAccess($user, $upgrade->source->project);
    }

    public function delete(User $user, DatabaseUpgrade $upgrade): bool
    {
        return $this->hasWriteAccess($user, $upgrade->source->project);
    }
}
