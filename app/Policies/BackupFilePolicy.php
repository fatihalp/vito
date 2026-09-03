<?php

namespace App\Policies;

use App\Models\Backup;
use App\Models\BackupFile;
use App\Models\User;
use App\Traits\HasRolePolicies;
use Illuminate\Auth\Access\HandlesAuthorization;

class BackupFilePolicy
{
    use HandlesAuthorization;
    use HasRolePolicies;

    public function viewAny(User $user, Backup $backup): bool
    {
        return $this->hasServerReadAccess($user, $backup->server);
    }

    public function view(User $user, BackupFile $backupFile): bool
    {
        $server = $backupFile->backup->server;

        return $this->hasServerReadAccess($user, $server);
    }

    public function create(User $user, Backup $backup): bool
    {
        $server = $backup->server;

        return $this->hasWriteAccess($user, $server->project) && $server->isReady();
    }

    public function update(User $user, BackupFile $backupFile): bool
    {
        $server = $backupFile->backup->server;

        return $this->hasWriteAccess($user, $server->project) && $server->isReady();
    }

    public function delete(User $user, BackupFile $backupFile): bool
    {
        $server = $backupFile->backup->server;

        return $this->hasWriteAccess($user, $server->project) && $server->isReady();
    }
}
