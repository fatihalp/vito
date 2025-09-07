<?php

namespace App\Actions\StorageProvider;

use App\Contracts\Actions\StorageProvider\EditStorageProvider as EditStorageProviderContract;
use App\Models\Project;
use App\Models\StorageProvider;
use Illuminate\Support\Facades\Validator;

class EditStorageProvider implements EditStorageProviderContract
{
    /**
     * @param  array<string, mixed>  $input
     */
    public function edit(StorageProvider $storageProvider, Project $project, array $input): StorageProvider
    {
        Validator::make($input, [
            'name' => [
                'required',
            ],
        ])->validate();

        $storageProvider->profile = $input['name'];
        $storageProvider->project_id = isset($input['global']) && $input['global'] ? null : $project->id;

        $storageProvider->save();

        return $storageProvider;
    }
}
