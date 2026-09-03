<?php

namespace App\Policies;

use App\Models\Redirect;
use App\Models\Server;
use App\Models\Site;
use App\Models\User;
use App\Traits\HasRolePolicies;

class RedirectPolicy
{
    use HasRolePolicies;

    public function viewAny(User $user, Site $site, Server $server): bool
    {
        return $this->hasServerReadAccess($user, $server) &&
            $site->isReady();
    }

    public function view(User $user, Redirect $redirect, Site $site, Server $server): bool
    {
        $siteServer = $site->server;

        return $this->hasServerReadAccess($user, $siteServer)
            && $site->server_id === $server->id
            && $redirect->site_id === $site->id;
    }

    public function create(User $user, Site $site, Server $server): bool
    {
        $siteServer = $site->server;

        return $this->hasWriteAccess($user, $siteServer->project)
            && $site->server_id === $server->id
            && $siteServer->isReady();
    }

    public function update(User $user, Redirect $redirect, Site $site, Server $server): bool
    {
        $siteServer = $site->server;

        return $this->hasWriteAccess($user, $siteServer->project)
            && $site->server_id === $server->id
            && $server->isReady()
            && $redirect->site_id === $site->id;
    }

    public function delete(User $user, Redirect $redirect, Site $site, Server $server): bool
    {
        $siteServer = $site->server;

        return $this->hasWriteAccess($user, $siteServer->project)
            && $site->server_id === $server->id
            && $server->isReady()
            && $redirect->site_id === $site->id;
    }
}
