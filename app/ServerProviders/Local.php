<?php

namespace App\ServerProviders;

use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

class Local extends AbstractProvider
{
    public static function id(): string
    {
        return 'local';
    }

    public function createRules(array $input): array
    {
        return [];
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
        /** @var FilesystemAdapter $storageDisk */
        $storageDisk = Storage::disk(config('core.key_pairs_disk'));
        File::copy(
            storage_path(config('core.ssh_private_key_name')),
            $storageDisk->path((string) $this->server->id)
        );
        File::copy(
            storage_path(config('core.ssh_public_key_name')),
            $storageDisk->path($this->server->id.'.pub')
        );
    }

    public function isRunning(): bool
    {
        return true;
    }

    public function delete(): void
    {
        //
    }
}
