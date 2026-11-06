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

        $existing = $server->sshKeys()->whereKey($sshKey->id)->first();
        if ($existing && $existing->pivot->user !== $user) {
            throw ValidationException::withMessages(['user' => __('Remove this key from its current user before deploying it to another user.')]);
        }

        $server->sshKeys()->syncWithoutDetaching([$sshKey->id => [
            'status' => SshKeyStatus::ADDING,
            'user' => $user,
        ]]);
        try {
            $server->os()->deploySSHKey($sshKey->public_key, $user);
        } catch (Throwable $e) {
            $server->sshKeys()->updateExistingPivot($sshKey->id, ['status' => SshKeyStatus::FAILED]);
            throw ValidationException::withMessages(['key' => __('SSH key deployment could not be confirmed. Check that the target user exists and Vito can connect as that user, then retry.')]);
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
