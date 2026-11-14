<?php

namespace App\Actions\SshKey;

use App\Enums\SshKeyStatus;
use App\Models\Server;
use App\Models\SshKey;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class DeployKeyToServer
{
    
    public function deploy(Server $server, SshKey $sshKey, array $input): void
    {
        $this->validate($server, $input);

        $user = $input['user'];

        if ($server->sshKeys()->where('ssh_keys.id', $sshKey->id)->exists()) {
            throw ValidationException::withMessages([
                'user' => __('This key is already deployed to the server. Remove it first to deploy it for another user.'),
            ]);
        }

        $server->sshKeys()->attach($sshKey, [
            'status' => SshKeyStatus::ADDING,
            'user' => $user,
        ]);

        try {
            $server->os()->deploySSHKey($sshKey->public_key, $user);
        } catch (Throwable $e) {
            $server->sshKeys()->detach($sshKey);

            throw $e;
        }

        $sshKey->servers()->updateExistingPivot($server->id, [
            'status' => SshKeyStatus::ADDED,
            'user' => $user,
        ]);
    }

    private function validate(Server $server, array $input): void
    {
        $rules = [
            'user' => [
                'required',
                'string',
                Rule::in($server->getSshUsers()),
            ],
        ];

        Validator::make($input, $rules)->validate();
    }
}
