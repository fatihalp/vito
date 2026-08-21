<?php

namespace App\Actions\Site;

use App\Models\Site;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class GetAccessibleSites
{
    
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
        ])->validate();
        $scope = (string) ($validated['project'] ?? 'all');

        $query = Site::query()
            ->whereHas('server', function (Builder $servers) use ($accessibleProjectIds, $scope): void {
                $servers->whereIn('project_id', $scope === 'all' ? $accessibleProjectIds : [(int) $scope]);
            });

        return [
            'query' => $query,
            'scope' => $scope,
        ];
    }
}
