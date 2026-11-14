<?php

namespace App\Actions\Backup;

use App\Helpers\QueryBuilder;
use App\Models\Backup;
use App\Models\ServerLog;
use Illuminate\Contracts\Pagination\Paginator;
use Illuminate\Database\Eloquent\Builder;

class GetBackupLogs
{
    public function handle(Backup $backup): Paginator
    {
        $serverIds = collect($backup->cluster?->nodes()->pluck('id'))->push($backup->server_id)->unique();

        return QueryBuilder::for(
            ServerLog::query()
                ->with('server')
                ->whereIn('server_id', $serverIds)
                ->where('is_remote', 0)
                ->where(fn (Builder $query) => $query
                    ->where('type', 'like', 'pgbackrest%')
                    ->orWhere('type', 'like', '%backup%')
                    ->orWhere('type', 'like', '%restore%'))
        )
            ->searchableFields(['name'])
            ->sortable('created_at', 'desc')
            ->query()
            ->simplePaginate(config('web.pagination_size'));
    }
}
