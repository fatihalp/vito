<?php

namespace App\Models;

use App\Enums\NetworkAddressingPool;
use App\Enums\NetworkStatus;
use App\Enums\NetworkType;
use Database\Factories\NetworkFactory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;


class Network extends AbstractModel
{
    
    use HasFactory;

    protected $fillable = [
        'project_id',
        'name',
        'type',
        'status',
        'addressing_pool',
        'cidr',
        'cidr_canonical',
        'port',
        'region',
    ];

    protected $casts = [
        'project_id' => 'integer',
        'port' => 'integer',
        'server_provider_id' => 'integer',
        'last_synced_at' => 'datetime',
        'type' => NetworkType::class,
        'status' => NetworkStatus::class,
        'addressing_pool' => NetworkAddressingPool::class,
    ];

    
    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    
    public function serverProvider(): BelongsTo
    {
        return $this->belongsTo(ServerProvider::class);
    }

    
    public function servers(): HasMany
    {
        return $this->hasMany(NetworkServer::class);
    }

    
    public function firewallRules(): HasMany
    {
        return $this->hasMany(NetworkFirewallRule::class);
    }

    
    public function serverRules(): HasMany
    {
        return $this->hasMany(ServerNetworkRule::class);
    }

    
    public function peers(): HasMany
    {
        return $this->hasMany(NetworkPeer::class);
    }

    
    public function serverLogs(): HasMany
    {
        return $this->hasMany(ServerLog::class);
    }
}
