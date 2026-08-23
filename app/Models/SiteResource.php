<?php

namespace App\Models;

use App\Enums\SiteResourceType;
use App\Enums\SiteResourceStatus;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SiteResource extends AbstractModel
{
    protected $fillable = [
        'site_id',
        'server_id',
        'storage_provider_id',
        'type',
        'status',
        'configuration',
        'environment',
        'original_environment',
    ];

    protected $casts = [
        'site_id' => 'integer',
        'server_id' => 'integer',
        'storage_provider_id' => 'integer',
        'type' => SiteResourceType::class,
        'status' => SiteResourceStatus::class,
        'configuration' => 'encrypted:json',
        'environment' => 'encrypted:json',
        'original_environment' => 'encrypted:json',
    ];

    protected $hidden = [
        'configuration',
        'environment',
        'original_environment',
    ];

    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    public function storageProvider(): BelongsTo
    {
        return $this->belongsTo(StorageProvider::class, 'storage_provider_id');
    }
}
