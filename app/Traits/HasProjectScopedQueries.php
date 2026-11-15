<?php

namespace App\Traits;

use App\Actions\Projects\GetProjectScope;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

trait HasProjectScopedQueries
{
    public static function getByProjectId(int $projectId, User $user): Builder
    {
        return self::scopedToProjects($user, [$projectId]);
    }

    public static function forCurrentScope(User $user): Builder
    {
        return self::scopedToProjects($user, app(GetProjectScope::class)->ids($user));
    }

    private static function scopedToProjects(User $user, array $projectIds): Builder
    {
        $query = static::query();

        $query->where('user_id', $user->id);

        $query->where(function (Builder $query) use ($projectIds): void {
            $query->whereIn('project_id', $projectIds)->orWhereNull('project_id');
        });

        return $query;
    }
}
