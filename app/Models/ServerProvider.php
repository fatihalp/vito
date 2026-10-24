<?php

namespace App\Models;

use App\Traits\HasProjectScopedQueries;
use Database\Factories\ServerProviderFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Cache;

class ServerProvider extends AbstractModel
{
    use HasProjectScopedQueries;
    
    use HasFactory;


    protected $fillable = [
        'user_id',
        'profile',
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

    
    public function servers(): HasMany
    {
        return $this->hasMany(Server::class, 'provider_id');
    }

    public function provider(): \App\ServerProviders\ServerProvider
    {
        $providerClass = config('server-provider.providers.'.$this->provider.'.handler');

        
        $provider = new $providerClass($this, new Server);

        return $provider;
    }

    
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /**
     * Provider catalogues change rarely, so they are cached per provider and dropped by forgetCatalogue() when credentials change.
     *
     * @return array<string, mixed>
     */
    public function cachedRegions(): array
    {
        return Cache::remember($this->catalogueKey('regions'), now()->addMinutes(10), fn (): array => $this->provider()->regions());
    }

    /**
     * @return array<string, mixed>
     */
    public function cachedPlans(string $region, bool $available = false): array
    {
        return Cache::remember($this->catalogueKey('plans:'.($available ? 'available:' : '').$region), now()->addMinutes(10), fn (): array => $available ? $this->provider()->availablePlans($region) : $this->provider()->plans($region));
    }

    public function forgetCatalogue(): void
    {
        Cache::forever("server-provider:{$this->id}:catalogue-version", (string) now()->getTimestampMs());
    }

    private function catalogueKey(string $suffix): string
    {
        $version = Cache::get("server-provider:{$this->id}:catalogue-version", '0');

        return "server-provider:{$this->id}:{$version}:{$suffix}";
    }


}
