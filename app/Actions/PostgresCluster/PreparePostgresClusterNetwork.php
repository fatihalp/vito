<?php

namespace App\Actions\PostgresCluster;

use App\Actions\Network\AttachProviderNetwork;
use App\Actions\Network\ConnectServerPairToNetwork;
use App\Actions\Network\DeleteNetwork;
use App\Actions\Network\FindSharedNetwork;
use App\Enums\NetworkType;
use App\Models\PostgresCluster;
use App\Models\Server;
use RuntimeException;

class PreparePostgresClusterNetwork
{
    public function __construct(private FindSharedNetwork $networks, private ConnectServerPairToNetwork $pair) {}

    public function prepare(PostgresCluster $cluster, Server $node): bool
    {
        $primary = $cluster->primary;

        if ($cluster->network === null || $this->canLeave($cluster, $node)) {
            $this->choose($cluster, $primary, $node);
        }

        $network = $cluster->network;

        if (! $this->pair->join($network, $primary, $node, $this->providerNetworkName($cluster))) {
            throw new RuntimeException(__('The server :server is not on the private network :network used by this PostgreSQL cluster, and Vito cannot add it: it must be at the same provider, account and network zone.', [
                'server' => $node->name,
                'network' => $network->name,
            ]));
        }

        return $this->pair->ready($network, $primary, $node);
    }

    private function canLeave(PostgresCluster $cluster, Server $node): bool
    {
        return $cluster->owns_network
            && $cluster->network->type === NetworkType::WIREGUARD
            && $cluster->streamingReplicas()->where('replica_server_id', '!=', $node->id)->isEmpty();
    }

    private function choose(PostgresCluster $cluster, Server $primary, Server $node): void
    {
        $current = $cluster->network;
        $types = config('database-replication.network_types');
        $network = in_array(NetworkType::PROVIDER->value, $types, true)
            ? app(AttachProviderNetwork::class)->attach($primary, $node, $this->providerNetworkName($cluster))
            : null;
        $network ??= $this->networks->between($primary, $node, $types);

        if ($current !== null && ($network === null || $network->type === NetworkType::WIREGUARD)) {
            return;
        }

        $owns = $network === null;
        $network ??= $this->pair->createWireGuard('postgres-'.$cluster->stanza, $primary, $node);

        $cluster->update(['network_id' => $network->id, 'owns_network' => $owns]);
        $cluster->setRelation('network', $network);

        if ($current !== null) {
            app(DeleteNetwork::class)->delete($current);
        }
    }

    private function providerNetworkName(PostgresCluster $cluster): string
    {
        return 'vito-postgres-'.$cluster->stanza;
    }
}
