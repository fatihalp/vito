<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class SshKey extends AbstractModel
{
    
    use HasFactory;

    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'name',
        'public_key',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'public_key' => 'encrypted',
    ];

    
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    
    public function servers(): BelongsToMany
    {
        return $this->belongsToMany(Server::class, 'server_ssh_keys')
            ->withPivot('status', 'user')
            ->withTimestamps();
    }

}
