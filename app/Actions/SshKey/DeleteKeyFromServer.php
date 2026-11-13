<?php

namespace App\Actions\SshKey;

use App\Enums\SshKeyStatus;
use App\Models\Server;
use App\Models\SshKey;
use Illuminate\Validation\ValidationException;
use Throwable;

class DeleteKeyFromServer
{
    
    public function delete(Server $server, SshKey $sshKey): void
    {
        $pivot = $server->sshKeys()->where('ssh_keys.id', $sshKey->id)->first();
        if (! $pivot) {
            return;
        }
        $user = $pivot->pivot->user ?? $server->getSshUser();

        $sshKey->servers()->updateExistingPivot($server->id, [
            'status' => SshKeyStatus::DELETING,
        ]);
        try {
            $server->os()->deleteSSHKey($sshKey->public_key, $user);
        } catch (Throwable $e) {
            $server->sshKeys()->updateExistingPivot($sshKey->id, ['status' => SshKeyStatus::FAILED]);
            throw ValidationException::withMessages(['key' => __('SSH key removal could not be confirmed. Access may still be active. Check the target user and connection, then retry.')]);
        }
        $server->sshKeys()->detach($sshKey);
    }
}
