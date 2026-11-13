<?php

namespace App\Actions\Site;

use App\Actions\Server\EnsureSelfServerExists;
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
                Rule::in(['none', 'project', 'server']),
            ],
        ])->validate();

        $scope = (string) ($validated['project'] ?? $user->current_project_id);
        $groupBy = (string) ($validated['group_by'] ?? 'none');

        $query = Site::query()
            ->whereHas('server', function (Builder $servers) use ($accessibleProjectIds, $scope): void {
                $servers->whereIn('project_id', $scope === 'all' ? $accessibleProjectIds : [(int) $scope]);
            });

        return [
            'query' => $query,
            'groupBy' => $groupBy,
        ];
    }
}

