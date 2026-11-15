<?php

namespace App\Actions\Projects;

use App\Models\Project;
use Illuminate\Validation\ValidationException;

class DeleteProject
{
    public function delete(Project $project): void
    {
        if ($project->servers()->exists()) {
            throw ValidationException::withMessages([
                'project' => __('This project still has servers. Delete or move them first.'),
            ]);
        }

        $project->delete();
    }
}
