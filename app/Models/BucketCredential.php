<?php

namespace App\Models;

use Database\Factories\BucketCredentialFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $project_id
 * @property array{access_key: string, secret_key: string} $credentials
 * @property Project $project
 */
class BucketCredential extends AbstractModel
{
    /** @use HasFactory<BucketCredentialFactory> */
    use HasFactory;

    protected $fillable = [
        'project_id',
        'credentials',
    ];

    protected $casts = [
        'project_id' => 'integer',
        'credentials' => 'encrypted:array',
    ];

    protected $hidden = [
        'credentials',
    ];

    /** @return BelongsTo<Project, covariant $this> */
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
