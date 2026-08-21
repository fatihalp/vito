<?php

namespace App\Models;

use App\Enums\FirewallRuleStatus;
use Database\Factories\NetworkFirewallRuleFactory;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;


class NetworkFirewallRule extends AbstractModel
{
    
    use HasFactory;

    protected $fillable = [
        'network_id',
        'name',
        'protocol',
        'port',
        'status',
    ];

    protected $casts = [
        'network_id' => 'integer',
        'status' => FirewallRuleStatus::class,
    ];

    
    public function network(): BelongsTo
    {
        return $this->belongsTo(Network::class);
    }

    
    public function serverRules(): HasMany
    {
        return $this->hasMany(ServerNetworkRule::class);
    }
}
