<?php

namespace App\Actions\Site;

use App\Models\Server;
use App\Models\Site;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class GetAccessibleSites
{
    /**
     * @param array<string, mixed> $input
     * @return array{
     *     query: Builder<Site>,
     *     scope: string,
     *     serverScope: string,
     *     groupBy: string,
     *     servers: array<int, array{id: int, name: string, project_id: int, project_name: string|null}>
     * }
     */
    public function get(User $user, array $input): array
    {
        $accessibleProjectIds = $user->allProjects()->pluck('id');

        $accessibleServers = Server::query()
            ->whereIn('project_id', $accessibleProjectIds)
            ->with('project:id,name')
            ->orderBy('name')
            ->get(['id', 'name', 'project_id']);

        $validated = Validator::make($input, [
            'project' => [
                'nullable',
                Rule::in([
                    'all',
                    ...$accessibleProjectIds->map(fn (int $id): string => (string) $id),
                ]),
            ],
            'server' => [
                'nullable',
                Rule::in([
                    'all',
                    ...$accessibleServers->pluck('id')->map(fn (int $id): string => (string) $id),
                ]),
            ],
            'group_by' => [
                'nullable',
                Rule::in(['none', 'project', 'server']),
            ],
        ])->validate();

        $scope = (string) ($validated['project'] ?? 'all');
        $serverScope = (string) ($validated['server'] ?? 'all');
        $groupBy = (string) ($validated['group_by'] ?? 'none');

        $query = Site::query()
            ->whereHas('server', function (Builder $servers) use ($accessibleProjectIds, $scope): void {
                $servers->whereIn('project_id', $scope === 'all' ? $accessibleProjectIds : [(int) $scope]);
            });

        if ($serverScope !== 'all') {
            $query->where('server_id', (int) $serverScope);
        }

        $serverOptions = $accessibleServers->map(fn (Server $server): array => [
            'id' => $server->id,
            'name' => $server->name,
            'project_id' => $server->project_id,
            'project_name' => $server->project?->name,
        ])->values()->all();

        return [
            'query' => $query,
            'scope' => $scope,
            'serverScope' => $serverScope,
            'groupBy' => $groupBy,
            'servers' => $serverOptions,
        ];
    }
}

