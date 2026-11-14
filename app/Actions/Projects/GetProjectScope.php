<?php

namespace App\Actions\Projects;

use App\Http\Middleware\ResolveCurrentProject;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class GetProjectScope
{
    public function get(User $user): string
    {
        return (string) request()->attributes->get(ResolveCurrentProject::SCOPE_ATTRIBUTE, $user->current_project_id);
    }

    public function ids(User $user): array
    {
        $scope = $this->get($user);

        return $user->allProjects()
            ->when($scope !== 'all', fn ($query) => $query->whereKey((int) $scope))
            ->pluck('id')->all();
    }

    public function projectId(User $user, ?int $existingProjectId = null): int
    {
        if ($existingProjectId !== null) {
            return $existingProjectId;
        }

        $scope = $this->get($user);
        if ($scope === 'all') {
            throw ValidationException::withMessages(['project' => 'Select a project before creating a project-specific resource, or make the resource global.']);
        }

        return (int) $scope;
    }
}
