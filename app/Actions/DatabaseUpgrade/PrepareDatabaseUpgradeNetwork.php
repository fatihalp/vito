<?php

namespace App\Actions\DatabaseUpgrade;

use App\Actions\Network\AttachProviderNetwork;
use App\Actions\Network\ConnectServerPairToNetwork;
use App\Actions\Network\DeleteNetwork;
use App\Actions\Network\FindSharedNetwork;
use App\Enums\NetworkType;
use App\Models\DatabaseUpgrade;
use App\Models\PostgresCluster;
use App\Models\Server;
use RuntimeException;

class PrepareDatabaseUpgradeNetwork
{
    public function __construct(private FindSharedNetwork $networks, private ConnectServerPairToNetwork $pair) {}

    public function prepare(DatabaseUpgrade $upgrade): bool
    {
        $source = $upgrade->source;
        $target = $upgrade->target;

        if ($upgrade->network === null) {
            $this->choose($upgrade, $source, $target);
        }

        $network = $upgrade->network;

        if (! $this->pair->join($network, $source, $target, $this->name($upgrade))) {
            throw new RuntimeException(__('Vito could not put :server on the private network :network: both servers must be at the same provider, account and network zone.', [
                'server' => $target->name,
                'network' => $network->name,
            ]));
        }

        if (! $this->pair->ready($network, $source, $target)) {
            return false;
        }

        $upgrade->update(['configuration' => [
            ...($upgrade->configuration ?? []),
            'source_address' => $upgrade->address($source),
            'target_address' => $upgrade->address($target),
        ]]);

        return true;
    }

    public function release(DatabaseUpgrade $upgrade): void
    {
        $network = $upgrade->network;

        if (! $upgrade->owns_network || $network === null) {
            return;
        }

        $upgrade->update(['network_id' => null, 'owns_network' => false]);
        app(DeleteNetwork::class)->delete($network);
    }

    private function choose(DatabaseUpgrade $upgrade, Server $source, Server $target): void
    {
        $types = config('database-replication.network_types');
        $network = PostgresCluster::forServer($source)?->network;

        if ($network !== null && ! in_array($network->type->value, $types, true)) {
            $network = null;
        }

        $network ??= in_array(NetworkType::PROVIDER->value, $types, true)
            ? app(AttachProviderNetwork::class)->attach($source, $target, $this->name($upgrade))
            : null;
        $network ??= $this->networks->between($source, $target, $types);

        $owns = $network === null;
        $network ??= $this->pair->createWireGuard('pg-upgrade-'.$upgrade->id, $source, $target);

        $upgrade->update(['network_id' => $network->id, 'owns_network' => $owns]);
        $upgrade->setRelation('network', $network);
    }

    private function name(DatabaseUpgrade $upgrade): string
    {
        return 'vito-pg-upgrade-'.$upgrade->id;
    }
}
