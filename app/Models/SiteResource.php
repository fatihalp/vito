<?php

namespace App\Models;

use App\Enums\SiteResourceType;
use App\Enums\SiteResourceStatus;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $site_id
 * @property ?int $server_id
 * @property ?int $bucket_id
 * @property SiteResourceType $type
 * @property SiteResourceStatus $status
 * @property ?array<string, mixed> $configuration
 * @property array<string, string> $environment
 * @property ?array<string, string|null> $original_environment
 * @property Site $site
 * @property ?Server $server
 * @property ?Bucket $bucket
 */
class SiteResource extends AbstractModel
{
    protected $fillable = [
        'site_id',
        'server_id',
        'bucket_id',
        'type',
        'status',
        'configuration',
        'environment',
        'original_environment',
    ];

    protected $casts = [
        'site_id' => 'integer',
        'server_id' => 'integer',
        'bucket_id' => 'integer',
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

    /** @return BelongsTo<Site, covariant $this> */
    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    /** @return BelongsTo<Server, covariant $this> */
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    /** @return BelongsTo<Bucket, covariant $this> */
    public function bucket(): BelongsTo
    {
        return $this->belongsTo(Bucket::class);
    }
}
