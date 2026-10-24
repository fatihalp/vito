<?php

namespace App\Actions\Projects;

use App\Enums\UserRole;
use App\Models\Project;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class RemoveUserFromProject
{
    public function remove(Project $project, User $actor, int $membershipId): void
    {
        $membership = $project->users()->whereKey($membershipId)->first();

        if ($membership === null) {
            abort(404);
        }

        if ($membership->role === UserRole::OWNER) {
            throw ValidationException::withMessages(['user' => __('You cannot remove the project owner.')]);
        }

        if ($membership->user_id === $actor->id || ($membership->email !== null && $membership->email === $actor->email)) {
            throw ValidationException::withMessages(['user' => __('You cannot remove yourself from the project.')]);
        }

        $membership->delete();
    }
}
