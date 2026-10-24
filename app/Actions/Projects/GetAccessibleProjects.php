<?php

namespace App\Actions\Projects;

use App\Helpers\QueryBuilder;
use App\Models\User;
use Illuminate\Contracts\Pagination\Paginator;

class GetAccessibleProjects
{
    public function get(User $user): Paginator
    {
        $query = $user
            ->allProjects()
            ->withCount(['servers', 'sites'])
            ->with([
                'users' => fn ($query) => $query->where(fn ($w) => $w->whereNull('user_id')->orWhereHas('user')),
                'users.project',
                'users.user',
            ]);

        return QueryBuilder::for($query)
            ->searchableFields(['name'])
            ->sortable('created_at', 'desc', [
                'name' => 'name',
                'servers_count' => 'servers_count',
                'created_at' => 'created_at',
            ])
            ->simplePaginate(25);
    }
}
