<?php

namespace App\Models;

use Database\Factories\StorageProviderFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;


class StorageProvider extends AbstractModel
{
    
    use HasFactory;

    protected $fillable = [
        'user_id',
        'profile',
        'provider',
        'credentials',
        'project_id',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'credentials' => 'encrypted:array',
        'project_id' => 'integer',
    ];

    
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function provider(): \App\StorageProviders\StorageProvider
    {
        $providerClass = config('storage-provider.providers.'.$this->provider.'.handler');

        
        $provider = new $providerClass($this, new Server);

        return $provider;
    }

    public function hasProviderHandler(): bool
    {
        $providerClass = config('storage-provider.providers.'.$this->provider.'.handler');

        return is_string($providerClass) && is_a($providerClass, \App\StorageProviders\StorageProvider::class, true);
    }

    public function editableDataFor(?User $user): object
    {
        if (! $this->hasProviderHandler() || ! $user?->can('revealCredentials', $this)) {
            return (object) [];
        }

        return (object) $this->provider()->editableData();
    }

    
    public function backups(): HasMany
    {
        return $this->hasMany(Backup::class, 'storage_id');
    }

    
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    
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
