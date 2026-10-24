<?php

namespace App\Actions\Projects;

use App\Models\Project;

class DeleteProject
{
    public function delete(Project $project): void
    {
        $project->delete();
    }
}
