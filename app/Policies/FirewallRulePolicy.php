<?php

namespace App\Policies;

use App\Models\FirewallRule;
use App\Models\Server;
use App\Models\User;
use App\Traits\HasRolePolicies;
use Illuminate\Auth\Access\HandlesAuthorization;

class FirewallRulePolicy
{
    use HandlesAuthorization;
    use HasRolePolicies;

    public function viewAny(User $user, Server $server): bool
    {
        return $this->hasServerReadAccess($user, $server)
            && $server->firewall();
    }

    public function view(User $user, FirewallRule $rule): bool
    {
        $server = $rule->server;

        return $this->hasServerReadAccess($user, $server);
    }

    public function create(User $user, Server $server): bool
    {
        return $this->hasServerWriteAccess($user, $server)
            && $server->isReady()
            && $server->firewall();
    }

    public function update(User $user, FirewallRule $rule): bool
    {
        $server = $rule->server;

        return $this->hasServerWriteAccess($user, $server) &&
            $server->isReady();
    }

    public function delete(User $user, FirewallRule $rule): bool
    {
        $server = $rule->server;

        return $this->hasServerWriteAccess($user, $server) &&
            $server->isReady();
    }
}
