<?php

namespace App\Models;

use Database\Factories\BucketFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Bucket extends AbstractModel
{
    
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

    
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    
    public function siteResources(): HasMany
    {
        return $this->hasMany(SiteResource::class);
    }
}
