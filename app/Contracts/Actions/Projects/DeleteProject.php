<?php

namespace App\Contracts\Actions\Projects;

use App\Models\Project;
use App\Models\User;

interface DeleteProject
{
    public function delete(User $user, Project $project, array $input): void;
}
