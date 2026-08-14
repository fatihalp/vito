<?php

namespace App\Policies;

use App\Models\Server;
use App\Models\Site;
use App\Models\SiteResource;
use App\Models\User;
use App\Traits\HasRolePolicies;

class SiteResourcePolicy
{
    use HasRolePolicies;

    public function viewAny(User $user, Site $site, Server $server): bool
    {
        return $site->server_id === $server->id && $this->hasReadAccess($user, $server->project);
    }

    public function create(User $user, Site $site, Server $server): bool
    {
        return $site->server_id === $server->id && $this->hasWriteAccess($user, $server->project) && $site->isReady();
    }

    public function delete(User $user, SiteResource $resource, Site $site, Server $server): bool
    {
        return $resource->site_id === $site->id &&
            $site->server_id === $server->id &&
            $this->hasWriteAccess($user, $server->project);
    }
}
