<?php

namespace App\Models;

use Database\Factories\DNSProviderFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;


class DNSProvider extends AbstractModel
{
    
    use HasFactory;

    protected $table = 'dns_providers';

    protected $fillable = [
        'user_id',
        'name',
        'provider',
        'credentials',
        'connected',
        'project_id',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'credentials' => 'encrypted:array',
        'connected' => 'boolean',
        'project_id' => 'integer',
    ];

    
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    
    public function getCredentials(): array
    {
        return $this->credentials;
    }

    
    public function domains(): HasMany
    {
        return $this->hasMany(Domain::class, 'dns_provider_id');
    }

    public function provider(): \App\DNSProviders\DNSProvider
    {
        $providerClass = config('dns-provider.providers.'.$this->provider.'.handler');

        
        $provider = new $providerClass($this);

        return $provider;
    }

    public function hasProviderHandler(): bool
    {
        $providerClass = config('dns-provider.providers.'.$this->provider.'.handler');

        return is_string($providerClass) && is_a($providerClass, \App\DNSProviders\DNSProvider::class, true);
    }

    public function editableDataFor(?User $user): object
    {
        if (! $this->hasProviderHandler() || ! $user?->can('revealCredentials', $this)) {
            return (object) [];
        }

        return (object) $this->provider()->editableData();
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
