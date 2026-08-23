<?php

namespace App\Models;

use App\Enums\FirewallRuleStatus;
use Database\Factories\FirewallRuleFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FirewallRule extends AbstractModel
{
    
    use HasFactory;

    protected $fillable = [
        'name',
        'server_id',
        'type',
        'protocol',
        'port',
        'source',
        'mask',
        'note',
        'status',
    ];

    protected $casts = [
        'server_id' => 'integer',
        'status' => FirewallRuleStatus::class,
    ];

    
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }
}
