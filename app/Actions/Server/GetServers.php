<?php

namespace App\Actions\Server;

use App\Models\Project;
use App\Models\Server;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Validator;

class GetServers
{
    public function get(Project $project, array $input, int $perPage = 10): Collection
    {
        return $this->paginate($project->servers()->getQuery(), $input, $perPage);
    }

    public function getGlobal(User $user, array $input, int $perPage = 10): Collection
    {
        $serversQuery = Server::query()
            ->whereIn('project_id', $user->allProjects()->pluck('id'))
            ->orderByRaw('CASE WHEN project_id = ? THEN 0 ELSE 1 END', [$user->current_project_id])
            ->orderBy('project_id')
            ->orderBy('name');

        return $this->paginate($serversQuery, $input, $perPage);
    }

    private function paginate(Builder $serversQuery, array $input, int $perPage): Collection
    {
        $validated = $this->validate($input);

        $serversQuery->forResource();

        if (! empty($validated['exclude_self'])) {
            $serversQuery->where(function (Builder $query) {
                $query->where('is_self', false)->orWhereNull('is_self');
            });
        }

        if (! empty($validated['query'])) {
            $serversQuery->where('name', 'like', "%{$validated['query']}%");
        }

        return $serversQuery
            ->forPage($validated['page'] ?? 1, $perPage)
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
            'exclude_self' => [
                'nullable',
                'boolean',
            ],
        ])->validate();
    }
}
