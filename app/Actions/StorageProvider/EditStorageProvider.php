<?php

namespace App\Actions\StorageProvider;

use App\Actions\Backup\ManagePgBackRest;
use App\Models\StorageProvider;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class EditStorageProvider
{
    public function edit(StorageProvider $storageProvider, array $input, ?int $projectId): StorageProvider
    {
        if (! $storageProvider->hasProviderHandler()) {
            throw ValidationException::withMessages([
                'provider' => __('This storage provider is no longer available.'),
            ]);
        }

        $provider = $storageProvider->provider();

        $rules = array_merge(
            ['name' => ['required']],
            $provider->editValidationRules($input),
        );

        Validator::make($input, $rules)->validate();

        [$credentials, $needsReconnect] = $provider->mergeEditData($input);

        if ($needsReconnect) {
            app(VerifyStorageConnection::class)->verify($provider, $credentials);
        }

        $storageProvider->profile = $input['name'];
        $storageProvider->project_id = $projectId;

        $credentialsChanged = $credentials !== $storageProvider->credentials;

        if ($credentialsChanged) {
            $storageProvider->credentials = $credentials;
        }

        $storageProvider->save();

        $provider->forgetCachedState();

        if ($credentialsChanged) {
            app(ManagePgBackRest::class)->storageChanged($storageProvider);
        }

        return $storageProvider;
    }

}
