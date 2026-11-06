<?php

namespace App\Models;

use App\Enums\RuntimeProcessStatus;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class RuntimeProcess extends AbstractModel
{
    protected $fillable = ['server_id', 'label', 'driver', 'runtime_name', 'kind', 'status', 'details', 'last_checked_at'];

    protected $casts = [
        'server_id' => 'integer',
        'status' => RuntimeProcessStatus::class,
        'details' => 'array',
        'last_checked_at' => 'datetime',
    ];

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    public function sites(): BelongsToMany
    {
        return $this->belongsToMany(Site::class, 'runtime_process_site');
    }
}
