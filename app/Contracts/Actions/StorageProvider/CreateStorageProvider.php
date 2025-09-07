<?php

namespace App\Contracts\Actions\StorageProvider;

use App\Models\Project;
use App\Models\StorageProvider;
use App\Models\User;

interface CreateStorageProvider
{
    public function create(User $user, Project $project, array $input): StorageProvider;
}
