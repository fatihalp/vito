<?php

namespace App\Actions\Database;

use App\Actions\SiteResource\GuardProvisionedDatabase;
use App\Enums\DatabaseUserPermission;
use App\Models\DatabaseUser;
use App\Models\Service;
use App\Services\Database\Database;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UpdateDatabaseUser
{
    public function __construct(private GuardProvisionedDatabase $guard) {}

    
    public function update(DatabaseUser $databaseUser, array $input): DatabaseUser
    {
        $this->guard->user($databaseUser);
        $this->validate($databaseUser, $input);

        $oldHost = $databaseUser->host;
        $oldPermission = $databaseUser->permission;
        $newPassword = $input['password'] ?? null;
        $newHost = $this->changedHost($databaseUser, $input);
        $permissionChanged = false;

        if ($newHost !== null) {
            $databaseUser->host = $newHost;
        }

        if ($newPassword) {
            $databaseUser->password = $newPassword;
        }

        if ($input['permission'] !== $oldPermission->value) {
            $databaseUser->permission = $input['permission'];
            $permissionChanged = true;
        }

        if ($newPassword || $newHost) {
            
            $service = $databaseUser->server->database();

            
            $databaseHandler = $service->handler();
            $databaseHandler->updateUser(
                $databaseUser->username,
                $oldHost,
                $newPassword,
                $newHost
            );
        }

        $databaseUser->save();

        if ($newHost || $permissionChanged) {
            $this->updatePermissions($databaseUser, $oldHost, $newHost);
        }

        return $databaseUser;
    }

    public function updateManagedHost(DatabaseUser $databaseUser, string $host): DatabaseUser
    {
        
        $databaseHandler = $databaseUser->server->database()->handler();

        if (! $databaseHandler->usesHost() || $databaseUser->host === $host) {
            return $databaseUser;
        }

        $oldHost = $databaseUser->host;
        $databaseHandler->updateUser($databaseUser->username, $oldHost, newHost: $host);
        $databaseUser->host = $host;
        $databaseUser->save();

        $this->updatePermissions($databaseUser, $oldHost, $host);

        return $databaseUser;
    }

    private function validate(DatabaseUser $databaseUser, array $input): void
    {
        $rules = [];

        if (isset($input['password'])) {
            $rules['password'] = [
                'required',
                'min:6',
            ];
        }

        
        $handler = $databaseUser->server->database()->handler();

        if ($handler->usesHost()) {
            $rules['host'] = [
                isset($input['remote']) && $input['remote'] ? 'required' : 'nullable',
                'regex:/^[A-Za-z0-9%._:\-]*$/',
            ];
        }

        $rules['permission'] = [
            'required',
            Rule::in(array_map(fn ($case) => $case->value, DatabaseUserPermission::cases())),
        ];

        Validator::make($input, $rules)->validate();

        $newHost = $this->changedHost($databaseUser, $input);
        if ($newHost !== null && $handler->databaseUserExists($databaseUser->server, $databaseUser->username, $newHost, $databaseUser)) {
            throw ValidationException::withMessages([
                'host' => __('A database user with this username and host already exists.'),
            ]);
        }
    }

    
    private function changedHost(DatabaseUser $databaseUser, array $input): ?string
    {
        if (! isset($input['remote'])) {
            return null;
        }

        $handler = $databaseUser->server->database()?->handler();
        if (! $handler instanceof Database || ! $handler->usesHost()) {
            return null;
        }

        $resolved = $input['remote'] ? (! empty($input['host']) ? $input['host'] : '%') : 'localhost';

        return $resolved !== $databaseUser->host ? $resolved : null;
    }

    private function updatePermissions(DatabaseUser $databaseUser, string $oldHost, ?string $newHost): void
    {
        if (count($databaseUser->databases) === 0) {
            return;
        }

        
        $service = $databaseUser->server->database();

        
        $databaseHandler = $service->handler();

        $databaseHandler->unlink($databaseUser->username, $oldHost);

        $databaseHandler->link(
            $databaseUser->username,
            $newHost ?? $databaseUser->host,
            $databaseUser->databases,
            $databaseUser->permission->value
        );
    }
}
