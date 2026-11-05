<?php

namespace App\Actions\StorageProvider;

use App\Models\StorageProvider;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class CreateStorageProvider
{
    public function create(User $user, array $input, ?int $projectId): StorageProvider
    {
        $this->validate($input);

        $storageProvider = new StorageProvider([
            'user_id' => $user->id,
            'provider' => $input['provider'],
            'profile' => $input['name'],
            'project_id' => $projectId,
        ]);

        $provider = $storageProvider->provider();
        $storageProvider->credentials = $provider->credentialData($input);

        app(VerifyStorageConnection::class)->verify($provider, $storageProvider->credentials);

        $storageProvider->save();

        return $storageProvider;
    }

    private function validate(array $input): void
    {
        $rules = [
            'provider' => [
                'required',
                Rule::in(array_keys(config('storage-provider.providers'))),
            ],
            'name' => [
                'required',
            ],
        ];

        if (isset($input['provider']) && config('storage-provider.providers.'.$input['provider'].'.handler')) {
            $provider = (new StorageProvider(['provider' => $input['provider']]))->provider();
            $rules = array_merge($rules, $provider->validationRules());
        }

        Validator::make($input, $rules)->validate();
    }

}
