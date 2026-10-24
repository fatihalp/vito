<?php

namespace App\Policies;

use App\Models\DatabaseReplica;
use App\Models\Server;
use App\Models\User;
use App\Traits\HasRolePolicies;
use Illuminate\Auth\Access\HandlesAuthorization;

class DatabaseReplicaPolicy
{
    use HandlesAuthorization;
    use HasRolePolicies;

    public function viewAny(User $user, Server $server): bool
    {
        return $this->hasServerReadAccess($user, $server);
    }

    public function view(User $user, DatabaseReplica $replica): bool
    {
        return $this->hasServerReadAccess($user, $replica->primary);
    }

    public function create(User $user, Server $server): bool
    {
        return $this->hasServerWriteAccess($user, $server) && $server->isReady();
    }

    public function manage(User $user, Server $server): bool
    {
        return $this->hasServerWriteAccess($user, $server);
    }

    public function update(User $user, DatabaseReplica $replica): bool
    {
        return $this->hasServerWriteAccess($user, $replica->primary);
    }

    public function delete(User $user, DatabaseReplica $replica): bool
    {
        return $this->hasServerWriteAccess($user, $replica->primary);
    }
}
