<?php

namespace App\Policies;

use App\Models\RuntimeProcess;
use App\Models\Server;
use App\Models\User;
use App\Traits\HasRolePolicies;

class RuntimeProcessPolicy
{
    use HasRolePolicies;

    public function viewAny(User $user, Server $server): bool
    {
        return $this->hasServerReadAccess($user, $server);
    }

    public function create(User $user, Server $server): bool
    {
        return $this->hasOwnerAccess($user, $server->project)
            && $this->hasServerWriteAccess($user, $server)
            && $server->isReady();
    }

    public function manage(User $user, RuntimeProcess $process, Server $server): bool
    {
        return $process->server_id === $server->id && $this->create($user, $server);
    }
}
