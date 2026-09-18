<?php

namespace App\Actions\PostgresCluster;

use App\Actions\Network\AddServersToNetwork;
use App\Actions\Network\CreateNetwork;
use App\Actions\Network\DeleteNetwork;
use App\Actions\Network\FindSharedNetwork;
use App\Actions\Network\ManageNetworkFirewallRule;
use App\Actions\Network\SyncProviderNetworks;
use App\Enums\NetworkServerStatus;
use App\Enums\NetworkType;
use App\Models\Network;
use App\Models\PostgresCluster;
use App\Models\Server;
use App\ServerProviders\AttachesPrivateNetworks;
use RuntimeException;

class PreparePostgresClusterNetwork
{
    public function __construct(private FindSharedNetwork $networks) {}

    /**
     * Puts the node on the cluster's private network. A provider network such as a Hetzner Cloud Network is preferred:
     * Vito uses one both servers share, or asks their provider to attach both to one, and creates a WireGuard network
     * only when the provider cannot. Returns false while memberships are still being applied.
     */
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

    /**
     * A WireGuard network Vito created for the cluster is swapped for a provider network while no other replica streams over it.
     */
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
        $provider = $primary->provider_id !== null && $primary->provider_id === $node->provider_id ? $primary->serverProvider?->provider() : null;

        if (! $provider instanceof AttachesPrivateNetworks) {
            return null;
        }

        $ids = collect([$primary, $node])->map(fn (Server $server): string => (string) ($server->provider_data[$provider->instanceIdKey()] ?? ''));
        $attached = $ids->contains('') ? null : $provider->attachPrivateNetwork($ids->all(), 'vito-postgres-'.$cluster->stanza, $into?->external_id);

        if ($attached === null) {
            return null;
        }

        app(SyncProviderNetworks::class)->forProject($primary->project);

        $network = $primary->project->networks()->where('server_provider_id', $primary->provider_id)->where('external_id', $attached['id'])->first()
            ?? throw new RuntimeException(__('The provider attached both servers to a private network, but Vito could not load it. Sync the networks on the Networks page and retry.'));

        if ($attached['managed']) {
            $network->firewallRules()->where('name', 'Allow all')->get()->each(fn ($rule) => app(ManageNetworkFirewallRule::class)->delete($rule));
        }

        return $network;
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
