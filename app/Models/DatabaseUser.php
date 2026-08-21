<?php

namespace App\Models;

use App\Enums\DatabaseUserPermission;
use App\Enums\DatabaseUserStatus;
use Database\Factories\DatabaseUserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;


class DatabaseUser extends AbstractModel
{
    
    use HasFactory;

    protected $fillable = [
        'server_id',
        'username',
        'password',
        'databases',
        'permission',
        'host',
        'status',
    ];

    protected $casts = [
        'server_id' => 'integer',
        'password' => 'encrypted',
        'databases' => 'array',
        'permission' => DatabaseUserPermission::class,
        'status' => DatabaseUserStatus::class,
    ];

    protected $hidden = [
        'password',
    ];

    
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }
}
