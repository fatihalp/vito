<?php

namespace App\Policies;

use App\Enums\ServerRole;
use App\Models\PersonalAccessToken;
use App\Models\Server;
use App\Models\Site;
use App\Models\User;
use App\Traits\HasRolePolicies;
use Illuminate\Auth\Access\HandlesAuthorization;
use Laravel\Sanctum\TransientToken;

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
        $siteServer = $site->server;

        return $this->hasServerReadAccess($user, $siteServer)
            && $site->server_id === $server->id
            && $siteServer->role === ServerRole::APP
            && $siteServer->webserver();
    }

    public function create(User $user, Server $server): bool
    {
        return $this->hasWriteAccess($user, $server->project)
            && $server->isReady()
            && $server->role === ServerRole::APP
            && $server->webserver();
    }

    public function update(User $user, Site $site, Server $server): bool
    {
        $siteServer = $site->server;

        return $this->hasWriteAccess($user, $siteServer->project)
            && $site->server_id === $server->id
            && $siteServer->isReady()
            && $siteServer->webserver();
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
        $siteServer = $site->server;

        return $this->hasWriteAccess($user, $siteServer->project)
            && $site->server_id === $server->id
            && $siteServer->isReady()
            && $siteServer->webserver();
    }
}
