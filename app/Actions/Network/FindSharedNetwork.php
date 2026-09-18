<?php

namespace App\Actions\Network;

use App\Enums\NetworkServerStatus;
use App\Enums\NetworkStatus;
use App\Enums\NetworkType;
use App\Models\Network;
use App\Models\Server;
use Illuminate\Database\Eloquent\Builder;

class FindSharedNetwork
{
    /**
     * @var array<string, int>
     */
    private const PREFERENCE = ['provider' => 0, 'custom' => 1, 'wireguard' => 2];

    /**
     * Finds an active private network both servers are active members of, preferring provider networks when several types are allowed.
     */
    /**
     * @param  list<string>|null  $types
     */
    public function between(Server $first, Server $second, ?array $types = null): ?Network
    {
        return Network::query()
            ->where('project_id', $first->project_id)
            ->when($types !== null, fn (Builder $query) => $query->whereIn('type', $types))
            ->where('status', NetworkStatus::ACTIVE)
            ->whereHas('servers', fn ($query) => $this->activeMember($query, $first))
            ->whereHas('servers', fn ($query) => $this->activeMember($query, $second))
            ->get()
            ->sortBy(fn (Network $network): int => self::PREFERENCE[$network->type->value] ?? 9)
            ->first(fn (Network $network): bool => $this->address($network, $first) !== null && $this->address($network, $second) !== null);
    }

    public function address(Network $network, Server $server): ?string
    {
        return $network->servers()
            ->where('server_id', $server->id)
            ->where('status', NetworkServerStatus::ACTIVE)
            ->first()
            ?->address();
    }

    public function memberStatus(Network $network, Server $server): ?NetworkServerStatus
    {
        return $network->servers()->where('server_id', $server->id)->first()?->status;
    }

    private function activeMember(Builder $query, Server $server): void
    {
        $query->where('server_id', $server->id)->where('status', NetworkServerStatus::ACTIVE);
    }

    public static function canAddServers(Network $network): bool
    {
        return $network->type === NetworkType::WIREGUARD;
    }
}
