<?php

namespace App\Contracts\Actions\Server;

use App\Models\Project;
use App\Models\Server;
use App\Models\User;

interface CreateServer
{
    public function create(User $creator, Project $project, array $input): Server;
}
