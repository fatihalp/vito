<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CiRunner extends AbstractModel
{
    protected $fillable = ['site_id', 'server_id', 'repository', 'source_control_id', 'source_fingerprint', 'source_origin', 'user', 'executable', 'enabled'];

    protected $casts = ['site_id' => 'integer', 'server_id' => 'integer', 'source_control_id' => 'integer', 'enabled' => 'boolean'];

    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }
}
