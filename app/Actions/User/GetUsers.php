<?php

namespace App\Actions\User;

use App\Helpers\QueryBuilder;
use App\Models\User;
use Illuminate\Contracts\Pagination\Paginator;

class GetUsers
{
    public function get(User $viewer): Paginator
    {
        $query = User::query()->with([
            'projects' => fn ($query) => $query->withCount(['servers', 'sites'])->with(['users' => fn ($users) => $users->where('user_id', $viewer->id)]),
            'projectMemberships.project',
        ]);

        return QueryBuilder::for($query)
            ->searchableFields(['name', 'email'])
            ->sortable('created_at', 'desc', [
                'name' => 'name',
                'email' => 'email',
                'last_login_at' => 'last_login_at',
                'last_activity_at' => 'last_activity_at',
                'created_at' => 'created_at',
            ])
            ->simplePaginate();
    }
}
