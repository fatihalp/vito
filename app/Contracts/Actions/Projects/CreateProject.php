<?php

namespace App\Contracts\Actions\Projects;

use App\Models\Project;
use App\Models\User;

interface CreateProject
{
    public function create(User $user, array $input): Project;
}
