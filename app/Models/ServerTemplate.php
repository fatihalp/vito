<?php

namespace App\Models;

use Database\Factories\ServerTemplateFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;


class ServerTemplate extends AbstractModel
{
    
    use HasFactory;

    protected $fillable = [
        'user_id',
        'name',
        'services',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'services' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
