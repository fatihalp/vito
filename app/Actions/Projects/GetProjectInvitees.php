<?php

namespace App\Actions\Projects;

use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Validator;

class GetProjectInvitees
{
    
    public function get(Project $project, array $input): Collection
    {
        $validated = Validator::make($input, [
            'query' => ['nullable', 'string', 'max:255'],
        ])->validate();

        $query = trim($validated['query'] ?? '');

        return User::query()
            ->when($query === '', fn ($users) => $users->whereKey([]))
            ->whereNotIn('id', $project->users()->whereNotNull('user_id')->select('user_id'))
            ->whereNotIn('email', $project->users()->whereNotNull('email')->select('email'))
            ->where('email', $query)
            ->orderBy('name')
            ->limit(1)
            ->get();
    }
}
