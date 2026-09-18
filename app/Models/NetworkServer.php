<?php

namespace App\Models;

use App\Enums\NetworkServerStatus;
use Database\Factories\NetworkServerFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class NetworkServer extends AbstractModel
{
    
    use HasFactory;

    protected $fillable = [
        'network_id',
        'server_id',
        'server_ip_address_id',
        'ip',
        'public_key',
        'private_key',
        'status',
        'sync_attempts',
        'last_handshake_at',
    ];

    protected $casts = [
        'network_id' => 'integer',
        'server_id' => 'integer',
        'server_ip_address_id' => 'integer',
        'sync_attempts' => 'integer',
        'status' => NetworkServerStatus::class,
        'private_key' => 'encrypted',
        'last_handshake_at' => 'datetime',
    ];

    protected $hidden = [
        'private_key',
    ];

    
    public function address(): ?string
    {
        return $this->server_ip_address_id !== null ? $this->serverIpAddress?->ip : $this->ip;
    }

    /**
     * Whether WireGuard exchanged a handshake with this server recently. Keepalives renew it every two minutes and handshakes are
     * polled every three, so a working link is never older than five minutes. Null when nothing was observed yet.
     */
    public function connected(): ?bool
    {
        return $this->last_handshake_at?->gt(now()->subMinutes(5));
    }

    public function network(): BelongsTo
    {
        return $this->belongsTo(Network::class);
    }

    
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    
    public function serverIpAddress(): BelongsTo
    {
        return $this->belongsTo(ServerIpAddress::class);
    }

    
    public function rules(): HasMany
    {
        return $this->hasMany(ServerNetworkRule::class);
    }
}
