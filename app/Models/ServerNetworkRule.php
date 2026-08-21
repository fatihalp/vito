<?php

namespace App\Models;

use App\Enums\FirewallRuleStatus;
use App\Enums\ServerNetworkRuleKind;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\Query\Builder as QueryBuilder;


class ServerNetworkRule extends AbstractModel
{
    protected $fillable = [
        'server_id',
        'network_id',
        'network_server_id',
        'network_firewall_rule_id',
        'kind',
        'name',
        'type',
        'protocol',
        'port',
        'source',
        'mask',
        'status',
    ];

    protected $casts = [
        'server_id' => 'integer',
        'network_id' => 'integer',
        'network_server_id' => 'integer',
        'network_firewall_rule_id' => 'integer',
        'mask' => 'integer',
        'kind' => ServerNetworkRuleKind::class,
        'status' => FirewallRuleStatus::class,
    ];

    
    public static function applyOrder(Builder|QueryBuilder|Relation $query): void
    {
        $query
            ->orderByRaw('case when kind = ? then 0 else 1 end', [ServerNetworkRuleKind::HANDSHAKE->value])
            ->orderBy('network_id')
            ->orderBy('id');
    }

    
    public function scopeOrdered(Builder $query): void
    {
        self::applyOrder($query);
    }

    
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    
    public function network(): BelongsTo
    {
        return $this->belongsTo(Network::class);
    }

    
    public function networkServer(): BelongsTo
    {
        return $this->belongsTo(NetworkServer::class);
    }

    
    public function networkFirewallRule(): BelongsTo
    {
        return $this->belongsTo(NetworkFirewallRule::class);
    }
}
