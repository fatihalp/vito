<?php

namespace App\Actions\Projects;

use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Validator;

class GetProjectInvitees
{
    /**
     * @param array<string, mixed> $input
     * @return Collection<int, User>
     */
    public function get(Project $project, array $input): Collection
    {
        $validated = Validator::make($input, [
            'query' => ['nullable', 'string', 'max:255'],
        ])->validate();

        $search = trim($validated['query'] ?? '');

        return User::query()
            ->whereNotIn('id', $project->users()->whereNotNull('user_id')->select('user_id'))
            ->whereNotIn('email', $project->users()->whereNotNull('email')->select('email'))
            ->when($search !== '', function ($users) use ($search): void {
                $users->where(function ($q) use ($search): void {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->orderBy('name')
            ->limit(50)
            ->get();
    }
}
