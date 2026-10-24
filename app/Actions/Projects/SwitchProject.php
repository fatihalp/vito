<?php

namespace App\Actions\Projects;

use App\Models\Project;
use App\Models\User;

class SwitchProject
{
    public function switch(User $user, Project $project): void
    {
        $user->update([
            'current_project_id' => $project->id,
        ]);
    }
}
