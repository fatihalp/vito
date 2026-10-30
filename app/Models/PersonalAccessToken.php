<?php

namespace App\Models;

use App\Traits\HasTimezoneTimestamps;
use Laravel\Sanctum\PersonalAccessToken as SanctumPersonalAccessToken;

class PersonalAccessToken extends SanctumPersonalAccessToken
{
    use HasTimezoneTimestamps;

    
    public function getProjectIds(): array
    {
        return collect($this->abilities)
            ->filter(fn (string $ability) => str_starts_with($ability, 'project:'))
            ->map(fn (string $ability) => (int) str_replace('project:', '', $ability))
            ->values()
            ->all();
    }

    
    public function hasProjectAccess(Project $project): bool
    {
        return in_array($project->id, $this->getProjectIds());
    }

    public function allowsProjectId(?int $projectId, bool $write = false): bool
    {
        $projectIds = $this->getProjectIds();

        if ($projectIds === []) {
            return true;
        }

        if ($projectId === null) {
            return ! $write;
        }

        return in_array($projectId, $projectIds, true);
    }
}
