<?php

namespace App\Actions\Projects;

use App\Models\User;
use App\Models\UserProject;
use Illuminate\Contracts\Pagination\Paginator;

class GetPendingInvitations
{
    public function get(User $user, int $perPage = 20): Paginator
    {
        return UserProject::query()
            ->where('email', $user->email)
            ->whereNull('user_id')
            ->whereHas('project')
            ->simplePaginate($perPage);
    }
}
