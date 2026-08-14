<?php

namespace App\Actions\SiteResource;

use App\Enums\SiteResourceType;
use App\Models\Database;
use App\Models\DatabaseUser;
use App\Models\SiteResource;
use Illuminate\Validation\ValidationException;

class GuardProvisionedDatabase
{
    public function database(Database $database): void
    {
        if ($this->isReferenced($database->server_id, 'database_id', $database->id)) {
            throw ValidationException::withMessages([
                'database' => __('Disconnect the site resource before changing its Vito-managed database.'),
            ]);
        }
    }

    public function user(DatabaseUser $user): void
    {
        if ($this->isReferenced($user->server_id, 'database_user_id', $user->id)) {
            throw ValidationException::withMessages([
                'database_user' => __('Disconnect the site resource before changing its Vito-managed database user.'),
            ]);
        }
    }

    private function isReferenced(int $serverId, string $key, int $id): bool
    {
        return SiteResource::query()
            ->where('server_id', $serverId)
            ->where('type', SiteResourceType::DATABASE->value)
            ->get()
            ->contains(fn (SiteResource $resource): bool => (int) ($resource->configuration[$key] ?? 0) === $id);
    }
}
