<?php

namespace App\Models;

use App\Enums\DatabaseStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Database extends AbstractModel
{
    use HasFactory;

    use SoftDeletes;

    protected $fillable = [
        'server_id',
        'name',
        'collation',
        'charset',
        'status',
    ];

    protected $casts = [
        'server_id' => 'integer',
        'status' => DatabaseStatus::class,
    ];

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class)->withTrashed();
    }

    public function backups(): HasMany
    {
        return $this->hasMany(Backup::class)->where('type', 'database');
    }
}
