<?php

namespace App\ServerProviders;

use App\Exceptions\ServerProviderError;
use App\ValidationRules\RestrictedIPAddressesRule;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Throwable;

class Existing extends AbstractProvider
{
    public static function id(): string
    {
        return 'existing';
    }

    public function createRules(array $input): array
    {
        return [
            'ip' => [
                'required',
                'ip',
                Rule::unique('servers', 'ip'),
                new RestrictedIPAddressesRule,
            ],
            'port' => [
                'required',
                'numeric',
                'min:1',
                'max:65535',
            ],
            'ssh_user' => [
                'nullable',
                'string',
            ],
        ];
    }

    public function credentialValidationRules(array $input): array
    {
        return [];
    }

    public function credentialData(array $input): array
    {
        return [];
    }

    public function data(array $input): array
    {
        return [];
    }

    public function connect(array $credentials): bool
    {
        return true;
    }

    public function plans(?string $region): array
    {
        return [];
    }

    public function regions(): array
    {
        return [];
    }

    public function create(): void
    {
        $storageDisk = Storage::disk(config('core.key_pairs_disk'));
        File::copy(
            storage_path(config('core.ssh_private_key_name')),
            $storageDisk->path((string) $this->server->id)
        );
        File::copy(
            storage_path(config('core.ssh_public_key_name')),
            $storageDisk->path($this->server->id.'.pub')
        );

        $sshUser = $this->server->ssh_user ?: 'root';

        try {
            $this->server->ssh($sshUser)->connect();
        } catch (Throwable) {
            throw new ServerProviderError("Cannot connect to server via SSH as '{$sshUser}'. Make sure you have added Vito's public key to authorized_keys and the server is reachable.");
        }

        $output = $this->server->ssh($sshUser)->exec('id -u vito >/dev/null 2>&1 && test -f /home/vito/vito/artisan && echo "vito_managed_host" || echo "ok"');
        if (str_contains($output, 'vito_managed_host')) {
            throw new ServerProviderError('You cannot perform this action on Vito\'s server itself.');
        }
    }

    public function isRunning(): bool
    {
        return true;
    }

    public function delete(): void
    {
    }
}
