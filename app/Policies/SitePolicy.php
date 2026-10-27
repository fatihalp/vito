<?php

namespace App\Policies;

use App\Enums\ServerRole;
use App\Models\Server;
use App\Models\Site;
use App\Models\User;
use App\Traits\HasRolePolicies;
use Illuminate\Auth\Access\HandlesAuthorization;

class SitePolicy
{
    use HandlesAuthorization;
    use HasRolePolicies;

    public function viewAny(User $user, Server $server): bool
    {
        return $this->hasServerReadAccess($user, $server)
            && $server->role === ServerRole::APP
            && $server->webserver();
    }

    public function view(User $user, Site $site, Server $server): bool
    {
        if ($site->server_id !== $server->id) {
            return false;
        }

        if (! $site->relationLoaded('server')) {
            $site->setRelation('server', $server);
        }

        return $this->hasServerReadAccess($user, $server)
            && $server->role === ServerRole::APP
            && $server->webserver();
    }

    public function create(User $user, Server $server): bool
    {
        return $this->hasServerWriteAccess($user, $server)
            && ! $server->is_self
            && $server->isReady()
            && $server->role === ServerRole::APP
            && $server->webserver();
    }

    public function update(User $user, Site $site, Server $server): bool
    {
        if ($site->server_id !== $server->id) {
            return false;
        }

        if (! $site->relationLoaded('server')) {
            $site->setRelation('server', $server);
        }

        return $this->hasServerWriteAccess($user, $server)
            && $server->isReady()
            && $server->webserver();
    }

    
    public function revealEnv(User $user, Site $site, Server $server): bool
    {
        
        $token = $user->currentAccessToken();

        if ($token !== null && ! $token->can('write')) {
            return false;
        }

        return $this->update($user, $site, $server);
    }

    public function delete(User $user, Site $site, Server $server): bool
    {
        if ($site->isSelf()) {
            return false;
        }

        return $this->update($user, $site, $server);
    }

    public function viewTooling(User $user, Site $site, Server $server): bool
    {
        return $this->view($user, $site, $server) && $site->isReady() && $site->isIsolated();
    }

    public function manageTooling(User $user, Site $site, Server $server): bool
    {
        return $this->update($user, $site, $server) && $site->isReady() && $site->isIsolated();
    }
}
