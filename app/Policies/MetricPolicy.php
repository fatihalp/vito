<?php

namespace App\Policies;

use App\Models\Metric;
use App\Models\Server;
use App\Models\User;
use App\Traits\HasRolePolicies;
use Illuminate\Auth\Access\HandlesAuthorization;

class MetricPolicy
{
    use HandlesAuthorization;
    use HasRolePolicies;

    public function viewAny(User $user, Server $server): bool
    {
        return $this->hasServerReadAccess($user, $server);
    }

    public function view(User $user, Metric $metric): bool
    {
        $server = $metric->server;

        return $this->hasServerReadAccess($user, $server);
    }

    public function create(User $user, Server $server): bool
    {
        return $this->hasServerWriteAccess($user, $server) &&
            $server->isReady();
    }

    public function update(User $user, Metric $metric): bool
    {
        $server = $metric->server;

        return $this->hasServerWriteAccess($user, $server) &&
            $server->isReady();
    }

    public function delete(User $user, Metric $metric): bool
    {
        $server = $metric->server;

        return $this->hasServerWriteAccess($user, $server) &&
            $server->isReady();
    }
}
