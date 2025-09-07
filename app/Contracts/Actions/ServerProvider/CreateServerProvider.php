<?php

namespace App\Contracts\Actions\ServerProvider;

use App\Models\Project;
use App\Models\ServerProvider;
use App\Models\User;

interface CreateServerProvider
{
    public function create(User $user, Project $project, array $input): ServerProvider;
}
