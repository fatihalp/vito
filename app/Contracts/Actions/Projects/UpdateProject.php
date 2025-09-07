<?php

namespace App\Contracts\Actions\Projects;

use App\Models\Project;

interface UpdateProject
{
    public function update(Project $project, array $input): Project;
}
