<?php

namespace App\Contracts\Actions\StorageProvider;

use App\Models\Project;
use App\Models\StorageProvider;

interface EditStorageProvider
{
    public function edit(StorageProvider $storageProvider, Project $project, array $input): StorageProvider;
}
