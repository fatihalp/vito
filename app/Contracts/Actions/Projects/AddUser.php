<?php

namespace App\Contracts\Actions\Projects;

use App\Models\Project;

interface AddUser
{
    public function add(Project $project, array $input): void;
}
