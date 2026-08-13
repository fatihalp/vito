<?php

namespace App\Models;

use Carbon\Carbon;
use Database\Factories\CommandFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Collection;

/**
 * @property int $id
 * @property int $site_id
 * @property string $name
 * @property string $command
 * @property bool $is_raw
 * @property Carbon $created_at
 * @property Carbon $updated_at
 * @property Collection<int, CommandExecution> $executions
 * @property ?CommandExecution $lastExecution
 * @property Site $site
 */
class Command extends AbstractModel
{
    /** @use HasFactory<CommandFactory> */
    use HasFactory;

    protected $fillable = [
        'site_id',
        'name',
        'command',
        'is_raw',
    ];

    protected $casts = [
        'site_id' => 'integer',
        'is_raw' => 'boolean',
    ];

    public static function boot(): void
    {
        parent::boot();

        static::deleting(function (Command $command): void {
            $command->executions()->delete();
        });
    }

    /**
     * @return BelongsTo<Site, covariant $this>
     */
    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    /**
     * @return array<string>
     */
    public function getVariables(): array
    {
        if ($this->is_raw) {
            return [];
        }

        $variables = [];
        preg_match_all('/\${(.*?)}/', $this->command, $matches);
        $variables = $matches[1];

        return array_unique($variables);
    }

    /**
     * @return HasMany<CommandExecution, covariant $this>
     */
    public function executions(): HasMany
    {
        return $this->hasMany(CommandExecution::class);
    }

    /**
     * @return HasOne<CommandExecution, covariant $this>
     */
    public function lastExecution(): HasOne
    {
        return $this->hasOne(CommandExecution::class)->latest();
    }
}
