<?php

namespace App\Models;

use App\Actions\Network\RemoveMembershipsForAddress;
use App\Enums\IpAddressFamily;
use App\Enums\IpAddressStatus;
use App\Enums\IpAddressType;
use Database\Factories\ServerIpAddressFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;


class ServerIpAddress extends AbstractModel
{
    
    use HasFactory;

    protected $fillable = [
        'ip',
        'prefix_length',
        'family',
        'interface',
    ];

    protected $casts = [
        'server_id' => 'integer',
        'prefix_length' => 'integer',
        'is_managed' => 'boolean',
        'is_primary' => 'boolean',
        'is_dynamic' => 'boolean',
        'family' => IpAddressFamily::class,
        'type' => IpAddressType::class,
        'status' => IpAddressStatus::class,
    ];

    
    protected array $reapplyNetworkIds = [];

    protected static function booted(): void
    {
        static::deleting(function (ServerIpAddress $address): void {
            $address->reapplyNetworkIds = app(RemoveMembershipsForAddress::class)->capture($address);
        });

        static::deleted(function (ServerIpAddress $address): void {
            app(RemoveMembershipsForAddress::class)->handle($address->server_id, $address->reapplyNetworkIds);
        });
    }

    
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    public static function classifyType(string $ip): IpAddressType
    {
        if (filter_var($ip, FILTER_VALIDATE_IP) === false) {
            return IpAddressType::UNKNOWN;
        }

        $isPublic = filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        );

        return $isPublic !== false ? IpAddressType::PUBLIC : IpAddressType::PRIVATE;
    }

    public static function familyFor(string $ip): IpAddressFamily
    {
        return str_contains($ip, ':') ? IpAddressFamily::V6 : IpAddressFamily::V4;
    }
}
