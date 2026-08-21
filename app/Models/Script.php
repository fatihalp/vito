<?php

namespace App\Models;

use Carbon\Carbon;
use Database\Factories\ScriptFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Collection;


class Script extends AbstractModel
{
    
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'content',
        'project_id',
    ];

    protected $casts = [
        'user_id' => 'int',
        'project_id' => 'int',
    ];

    public static function boot(): void
    {
        parent::boot();

        static::deleting(function (Script $script): void {
            $script->executions()->delete();
        });
    }

    
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    
    public function getVariables(): array
    {
        $variables = [];
        preg_match_all('/\${(.*?)}/', $this->content, $matches);
        $variables = $matches[1];

        return array_unique($variables);
    }

    
    public function executions(): HasMany
    {
        return $this->hasMany(ScriptExecution::class);
    }

    
    public function lastExecution(): HasOne
    {
        return $this->hasOne(ScriptExecution::class)->latest();
    }

    
    public static function getByProjectId(int $projectId, int $userId): Builder
    {
        
        $query = static::query();

        return $query
            ->where(function (Builder $query) use ($projectId, $userId): void {
                $query->where('project_id', $projectId)
                    ->orWhere('user_id', $userId)
                    ->orWhereNull('project_id');
            });
    }
}
