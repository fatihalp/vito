<?php

namespace App\Policies;

use App\Models\BackupMonitor;
use App\Models\Server;
use App\Models\User;
use App\Traits\HasRolePolicies;

class BackupMonitorPolicy
{
    use HasRolePolicies;

    public function view(User $user, BackupMonitor $monitor, Server $server): bool
    {
        return $monitor->server_id === $server->id && $this->hasServerReadAccess($user, $server);
    }

    public function create(User $user, Server $server): bool
    {
        return $user->isAdmin() && $this->hasServerOwnerAccess($user, $server);
    }

    public function run(User $user, BackupMonitor $monitor, Server $server): bool
    {
        return $this->view($user, $monitor, $server) && $this->hasServerOwnerAccess($user, $server);
    }

    public function delete(User $user, BackupMonitor $monitor, Server $server): bool
    {
        return $user->isAdmin() && $this->view($user, $monitor, $server) && $this->hasServerOwnerAccess($user, $server);
    }
}
