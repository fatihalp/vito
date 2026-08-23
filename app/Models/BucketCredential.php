<?php

namespace App\Models;

use Database\Factories\BucketCredentialFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BucketCredential extends AbstractModel
{
    
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

    
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
