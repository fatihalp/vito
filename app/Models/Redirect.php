<?php

namespace App\Models;

use App\Enums\RedirectStatus;
use Database\Factories\RedirectFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Redirect extends AbstractModel
{
    
    use HasFactory;

    public const int MODE_PROXY = 1000;

    protected $fillable = [
        'site_id',
        'from',
        'to',
        'mode',
        'websocket',
        'status',
    ];

    protected $casts = [
        'websocket' => 'boolean',
        'status' => RedirectStatus::class,
    ];

    
    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }
}
