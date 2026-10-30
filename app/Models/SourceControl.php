<?php

namespace App\Models;

use App\Traits\HasProjectScopedQueries;

use App\SourceControlProviders\SourceControlProvider;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Validation\Rule;

class SourceControl extends AbstractModel
{
    use HasProjectScopedQueries;
    public const string PROVIDER_GITHUB_APP = 'github-app';

    
    use HasFactory;

    use SoftDeletes;

    protected $fillable = [
        'provider',
        'provider_data',
        'profile',
        'url',
        'access_token',
        'project_id',
        'user_id',
        'external_identifier',
    ];

    protected $casts = [
        'access_token' => 'encrypted',
        'provider_data' => 'encrypted:array',
        'project_id' => 'integer',
        'user_id' => 'integer',
    ];

    public function isGithubApp(): bool
    {
        return $this->provider === self::PROVIDER_GITHUB_APP;
    }


    public static function usableForSitesProviders(): array
    {
        $providers = config('source-control.providers', []);

        return array_keys(array_filter(
            $providers,
            fn (array $config): bool => (bool) ($config['usable_for_sites'] ?? true),
        ));
    }


    public static function usableForServer(Server $server, ?User $user = null): Builder
    {
        $userId = $user?->id ?? user()?->id ?? $server->user_id;

        return static::query()
            ->whereIn('provider', self::usableForSitesProviders())
            ->where('user_id', $userId)
            ->where(function (Builder $query) use ($server): void {
                $query->where('project_id', $server->project_id)->orWhereNull('project_id');
            });
    }


    public static function siteValidationRules(Server $server, ?User $user = null): array
    {
        $userId = $user?->id ?? user()?->id ?? $server->user_id;

        return [
            'required',
            Rule::exists('source_controls', 'id')
                ->whereIn('provider', self::usableForSitesProviders())
                ->where(function ($query) use ($server, $userId): void {
                    $query->where('user_id', $userId)
                        ->where(function ($q) use ($server): void {
                            $q->where('project_id', $server->project_id)->orWhereNull('project_id');
                        });
                }),
        ];
    }

    public function provider(): SourceControlProvider
    {
        $providerClass = config('source-control.providers.'.$this->provider.'.handler');

        
        $provider = new $providerClass($this);

        return $provider;
    }

    public function getRepo(string $repo): mixed
    {
        return $this->provider()->getRepo($repo);
    }

    
    public function sites(): HasMany
    {
        return $this->hasMany(Site::class);
    }

    
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
