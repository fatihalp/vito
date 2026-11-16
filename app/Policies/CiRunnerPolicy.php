<?php

namespace App\Policies;

use App\Models\Server;
use App\Models\Site;
use App\Models\User;
use App\Traits\HasRolePolicies;

class CiRunnerPolicy
{
    use HasRolePolicies;

    public function viewAny(User $user, Site $site, Server $server): bool
    {
        return $site->server_id === $server->id && $this->hasReadAccess($user, $server->project);
    }

    public function configure(User $user, Site $site, Server $server): bool
    {
        return $user->isAdmin() && $this->viewAny($user, $site, $server) && $this->hasServerOwnerAccess($user, $server);
    }

    public function run(User $user, Site $site, Server $server): bool
    {
        return $this->viewAny($user, $site, $server)
            && $this->hasOwnerAccess($user, $server->project)
            && $this->hasServerWriteAccess($user, $server);
    }
}
