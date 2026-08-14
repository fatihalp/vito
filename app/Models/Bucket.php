<?php

namespace App\Models;

use Database\Factories\BucketFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $project_id
 * @property string $name
 * @property string $driver
 * @property array<string, mixed> $configuration
 * @property Project $project
 */
class Bucket extends AbstractModel
{
    /** @use HasFactory<BucketFactory> */
    use HasFactory;

    protected $fillable = [
        'project_id',
        'name',
        'driver',
        'configuration',
    ];

    protected $casts = [
        'project_id' => 'integer',
        'configuration' => 'encrypted:json',
    ];

    protected $hidden = [
        'configuration',
    ];

    /** @return BelongsTo<Project, covariant $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    /** @return HasMany<SiteResource, covariant $this> */
    public function siteResources(): HasMany
    {
        return $this->hasMany(SiteResource::class);
    }
}
