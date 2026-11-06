<?php

namespace App\Actions\Server;

use App\Models\Server;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class GetAccessibleServers
{
    public function get(User $user, array $input): array
    {
        app(EnsureSelfServerExists::class)->ensure($user);

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

        $scopeKey = 'project_scope.'.$user->id;
        $scope = (string) ($validated['project'] ?? session($scopeKey, 'all'));
        if ($scope !== 'all' && ! $accessibleProjectIds->contains((int) $scope)) {
            $scope = 'all';
        }
        if (! request()->headers->has('X-Inertia-Prefetch') && request()->header('Purpose') !== 'prefetch') {
            session([$scopeKey => $scope]);
        }
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
