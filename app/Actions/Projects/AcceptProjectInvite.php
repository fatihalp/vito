<?php

namespace App\Actions\Projects;

use App\Models\Project;
use App\Models\User;

class AcceptProjectInvite
{
    public function accept(Project $project, User $user): void
    {
        $invitation = $project->users()->where('email', $user->email)->first();

        if ($invitation === null) {
            abort(404);
        }

        $invitation->update(['email' => null, 'user_id' => $user->id]);
    }
}
