<?php

namespace App\Actions\Site;

use App\Models\Server;
use App\Models\Site;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Validator;

class GetSites
{
    public function get(Server $server, array $input, int $perPage = 10): Collection
    {
        $validated = $this->validate($input);

        $sitesQuery = $server->sites()->with('server');

        if (! empty($validated['query'])) {
            $sitesQuery->where('domain', 'like', "%{$validated['query']}%");
        }

        $page = $validated['page'] ?? 1;

        return $sitesQuery
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get();
    }

    public function getGlobal(User $user, array $input, ?int $currentServerId = null, int $perPage = 10): Collection
    {
        $validated = $this->validate($input);
        $accessibleProjectIds = $user->allProjects()->pluck('id');

        $sitesQuery = Site::query()
            ->with('server')
            ->whereHas('server', function (Builder $servers) use ($accessibleProjectIds): void {
                $servers->whereIn('project_id', $accessibleProjectIds);
            });

        if (! empty($validated['query'])) {
            $query = $validated['query'];
            $sitesQuery->where(function (Builder $q) use ($query) {
                $q->where('domain', 'like', "%{$query}%")
                    ->orWhereHas('server', function (Builder $sq) use ($query) {
                        $sq->where('name', 'like', "%{$query}%");
                    });
            });
        }

        if ($currentServerId) {
            $sitesQuery->orderByRaw('CASE WHEN server_id = ? THEN 0 ELSE 1 END', [$currentServerId]);
        }

        $sitesQuery->orderBy('domain', 'asc');

        $page = $validated['page'] ?? 1;

        return $sitesQuery
            ->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get();
    }

    private function validate(array $input): array
    {
        return Validator::make($input, [
            'query' => [
                'nullable',
                'string',
            ],
            'page' => [
                'nullable',
                'integer',
                'min:1',
            ],
            'current_server_id' => [
                'nullable',
                'integer',
            ],
        ])->validate();
    }
}
