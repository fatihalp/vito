<?php

namespace App\Traits;

use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

trait BelongsToProjectOrGlobal
{
    
    public static function getByProjectId(int $projectId, User $user): Builder
    {
        
        $query = static::query();

        return $query
            ->where('user_id', $user->id)
            ->where(function (Builder $query) use ($projectId): void {
                $query->where('project_id', $projectId)->orWhereNull('project_id');
            });
    }
}
