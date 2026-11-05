<?php

namespace App\Actions\Site;

use App\Actions\Server\EnsureSelfServerExists;
use App\Models\Server;
use App\Models\Site;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class GetAccessibleSites
{
    public function get(User $user, array $input): array
    {
        app(EnsureSelfServerExists::class)->ensure($user);

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

        $scopeKey = 'project_scope.'.$user->id;
        $scope = (string) ($validated['project'] ?? session($scopeKey, 'all'));
        if ($scope !== 'all' && ! $accessibleProjectIds->contains((int) $scope)) {
            $scope = 'all';
        }
        if (! request()->headers->has('X-Inertia-Prefetch') && request()->header('Purpose') !== 'prefetch') {
            session([$scopeKey => $scope]);
        }
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

