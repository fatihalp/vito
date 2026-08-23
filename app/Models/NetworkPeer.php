<?php

namespace App\Models;

use App\Enums\NetworkPeerStatus;
use Database\Factories\NetworkPeerFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

class NetworkPeer extends AbstractModel
{
    
    use HasFactory;

    protected $fillable = [
        'network_id',
        'name',
        'ip',
        'public_key',
        'private_key',
        'byo',
        'status',
        'last_handshake_at',
    ];

    protected $casts = [
        'network_id' => 'integer',
        'status' => NetworkPeerStatus::class,
        'private_key' => 'encrypted',
        'byo' => 'boolean',
        'last_handshake_at' => 'datetime',
        'sync_attempts' => 'integer',
    ];

    protected $hidden = [
        'private_key',
    ];

    
    public function hasPrivateKey(): bool
    {
        return ! $this->byo && $this->private_key !== null;
    }

    
    public function network(): BelongsTo
    {
        return $this->belongsTo(Network::class);
    }
}
