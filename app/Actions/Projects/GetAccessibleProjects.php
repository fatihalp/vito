<?php

namespace App\Actions\Projects;

use App\Actions\Server\ResolveHetznerServerSpecs;
use App\Helpers\QueryBuilder;
use App\Models\User;
use Illuminate\Contracts\Pagination\Paginator;

class GetAccessibleProjects
{
    public function get(User $user): Paginator
    {
        $costOrderSql = app(ResolveHetznerServerSpecs::class)->projectCostOrderSql();

        $query = $user
            ->allProjects()
            ->withCount(['servers', 'sites'])
            ->selectRaw("({$costOrderSql}) as monthly_cost_order")
            ->with([
                'servers:id,project_id,provider,provider_id,provider_data',
                'servers.serverProvider',
                'users' => fn ($query) => $query->where(fn ($w) => $w->whereNull('user_id')->orWhereHas('user')),
                'users.project',
                'users.user',
            ]);

        return QueryBuilder::for($query)
            ->searchableFields(['name'])
            ->sortable('created_at', 'desc', [
                'name' => 'name',
                'servers_count' => 'servers_count',
                'monthly_cost' => 'monthly_cost_order',
                'created_at' => 'created_at',
            ])
            ->simplePaginate(25);
    }
}
