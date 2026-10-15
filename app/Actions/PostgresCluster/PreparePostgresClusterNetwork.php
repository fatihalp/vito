<?php

namespace App\Actions\PostgresCluster;

use App\Actions\Network\AddServersToNetwork;
use App\Actions\Network\AttachProviderNetwork;
use App\Actions\Network\CreateNetwork;
use App\Actions\Network\DeleteNetwork;
use App\Actions\Network\FindSharedNetwork;
use App\Actions\Network\ManageNetworkFirewallRule;
use App\Enums\NetworkServerStatus;
use App\Enums\NetworkType;
use App\Models\Network;
use App\Models\PostgresCluster;
use App\Models\Server;
use RuntimeException;

class PreparePostgresClusterNetwork
{
    public function __construct(private FindSharedNetwork $networks) {}

    public function prepare(PostgresCluster $cluster, Server $node): bool
    {
        $primary = $cluster->primary;

        if ($cluster->network === null || $this->canLeave($cluster, $node)) {
            $this->choose($cluster, $primary, $node);
        }

        $network = $cluster->network;

        if ($this->networks->memberStatus($network, $node) === null) {
            $joined = match (true) {
                $network->type === NetworkType::PROVIDER => $this->attachProviderNetwork($cluster, $primary, $node, $network) !== null,
                FindSharedNetwork::canAddServers($network) => app(AddServersToNetwork::class)->add($network, ['servers' => [$node->id]]) !== false,
                default => false,
            };

            if (! $joined) {
                throw new RuntimeException(__('The server :server is not on the private network :network used by this PostgreSQL cluster, and Vito cannot add it: it must be at the same provider, account and network zone.', [
                    'server' => $node->name,
                    'network' => $network->name,
                ]));
            }
        }

        foreach ([$primary, $node] as $server) {
            $status = $this->networks->memberStatus($network, $server);

            if ($status === NetworkServerStatus::FAILED) {
                throw new RuntimeException(__('Connecting :server to the private network :network failed. Check the network logs.', [
                    'server' => $server->name,
                    'network' => $network->name,
                ]));
            }

            if ($status !== NetworkServerStatus::ACTIVE || $cluster->address($server) === null) {
                return false;
            }
        }

        if ($network->type === NetworkType::PROVIDER) {
            foreach ([$primary, $node] as $server) {
                $server->ssh()->exec(view('ssh.postgres-cluster.private-interface', ['address' => $cluster->address($server)]), 'postgres-private-interface');
            }
        }

        return true;
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
        $network = in_array(NetworkType::PROVIDER->value, $types, true) ? $this->attachProviderNetwork($cluster, $primary, $node) : null;
        $network ??= $this->networks->between($primary, $node, $types);

        if ($current !== null && ($network === null || $network->type === NetworkType::WIREGUARD)) {
            return;
        }

        $owns = $network === null;
        $network ??= $this->createWireGuard($cluster, $primary, $node);

        $cluster->update(['network_id' => $network->id, 'owns_network' => $owns]);
        $cluster->setRelation('network', $network);

        if ($current !== null) {
            app(DeleteNetwork::class)->delete($current);
        }
    }

    private function attachProviderNetwork(PostgresCluster $cluster, Server $primary, Server $node, ?Network $into = null): ?Network
    {
        return app(AttachProviderNetwork::class)->attach($primary, $node, 'vito-postgres-'.$cluster->stanza, $into);
    }

    private function createWireGuard(PostgresCluster $cluster, Server $primary, Server $node): Network
    {
        $network = app(CreateNetwork::class)->create($primary->project, [
            'name' => 'postgres-'.$cluster->stanza,
            'type' => 'wireguard',
            'servers' => [$primary->id, $node->id],
        ]);
        $network->firewallRules()->where('name', 'Allow all')->get()->each(fn ($rule) => app(ManageNetworkFirewallRule::class)->delete($rule));

        return $network;
    }
}
