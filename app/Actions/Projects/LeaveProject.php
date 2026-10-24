<?php

namespace App\Actions\Projects;

use App\Models\Project;
use App\Models\User;

class LeaveProject
{
    public function leave(Project $project, User $user): void
    {
        $membership = $project->users()
            ->where(fn ($query) => $query->where('user_id', $user->id)->orWhere('email', $user->email))
            ->first();

        if ($membership === null) {
            abort(404);
        }

        $membership->delete();
    }
}
