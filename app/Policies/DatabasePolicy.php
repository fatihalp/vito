<?php

namespace App\Policies;

use App\Models\Database;
use App\Models\Server;
use App\Models\User;
use App\Traits\HasRolePolicies;
use Illuminate\Auth\Access\HandlesAuthorization;

class DatabasePolicy
{
    use HandlesAuthorization;
    use HasRolePolicies;

    public function viewAny(User $user, Server $server): bool
    {
        return $this->hasServerReadAccess($user, $server);
    }

    public function view(User $user, Database $database): bool
    {
        $server = $database->server;

        return $this->hasServerReadAccess($user, $server) &&
            $server->database();
    }

    public function create(User $user, Server $server): bool
    {
        return $this->hasServerWriteAccess($user, $server) &&
            $server->isReady() &&
            $server->database();
    }

    public function browse(User $user, Database $database, Server $server): bool
    {
        return $database->server_id === $server->id && $this->hasServerOwnerAccess($user, $server);
    }

    public function update(User $user, Database $database): bool
    {
        $server = $database->server;

        return $this->hasServerWriteAccess($user, $server) &&
            $server->isReady() &&
            $server->database();
    }
}
