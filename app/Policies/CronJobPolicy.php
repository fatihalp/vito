<?php

namespace App\Policies;

use App\Models\CronJob;
use App\Models\Server;
use App\Models\Site;
use App\Models\User;
use App\Traits\HasRolePolicies;
use Illuminate\Auth\Access\HandlesAuthorization;

class CronJobPolicy
{
    use HandlesAuthorization;
    use HasRolePolicies;

    public function viewAny(User $user, Server $server, ?Site $site = null): bool
    {
        return $this->hasServerReadAccess($user, $server) &&
            (! $site || $site->server_id === $server->id);
    }

    public function view(User $user, CronJob $cronjob, Server $server, ?Site $site = null): bool
    {
        $cronJobServer = $cronjob->server;

        return $this->hasServerReadAccess($user, $cronJobServer) &&
            $cronjob->server_id === $server->id &&
            (! $site || ($site->server_id === $server->id && $cronjob->site_id === $site->id));
    }

    public function create(User $user, Server $server, ?Site $site = null): bool
    {
        return $this->hasServerWriteAccess($user, $server) && $server->isReady() &&
            (! $site || $site->server_id === $server->id);
    }

    public function update(User $user, CronJob $cronjob, Server $server, ?Site $site = null): bool
    {
        $cronJobServer = $cronjob->server;

        return $this->hasServerWriteAccess($user, $cronJobServer) &&
            $cronJobServer->isReady() &&
            $cronjob->server_id === $server->id &&
            (! $site || ($site->server_id === $server->id && $cronjob->site_id === $site->id));
    }

    public function delete(User $user, CronJob $cronjob, Server $server, ?Site $site = null): bool
    {
        $cronJobServer = $cronjob->server;

        return $this->hasServerWriteAccess($user, $cronJobServer) &&
            $cronJobServer->isReady() &&
            $cronjob->server_id === $server->id &&
            (! $site || ($site->server_id === $server->id && $cronjob->site_id === $site->id));
    }
}
