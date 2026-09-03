<?php

namespace App\Actions\Server;

use App\Models\Server;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class GetAccessibleServers
{
    /**
     * @param array<string, mixed> $input
     * @return array{
     *     query: Builder<Server>,
     *     scope: string,
     *     groupBy: string
     * }
     */
    public function get(User $user, array $input): array
    {
        $accessibleProjectIds = $user->allProjects()->pluck('id');

        $validated = Validator::make($input, [
            'project' => [
                'nullable',
                Rule::in([
                    'all',
                    ...$accessibleProjectIds->map(fn (int $id): string => (string) $id),
                ]),
            ],
            'group_by' => [
                'nullable',
                Rule::in(['none', 'project']),
            ],
        ])->validate();

        $scope = (string) ($validated['project'] ?? 'all');
        $groupBy = (string) ($validated['group_by'] ?? 'none');

        $query = Server::query()
            ->whereIn('project_id', $scope === 'all' ? $accessibleProjectIds : [(int) $scope]);

        return [
            'query' => $query,
            'scope' => $scope,
            'groupBy' => $groupBy,
        ];
    }
}
