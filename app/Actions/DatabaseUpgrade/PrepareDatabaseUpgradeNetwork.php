<?php

namespace App\Actions\DatabaseUpgrade;

use App\Actions\Network\AddServersToNetwork;
use App\Actions\Network\AttachProviderNetwork;
use App\Actions\Network\CreateNetwork;
use App\Actions\Network\DeleteNetwork;
use App\Actions\Network\FindSharedNetwork;
use App\Actions\Network\ManageNetworkFirewallRule;
use App\Enums\NetworkServerStatus;
use App\Enums\NetworkType;
use App\Models\DatabaseUpgrade;
use App\Models\Network;
use App\Models\PostgresCluster;
use App\Models\Server;
use RuntimeException;

class PrepareDatabaseUpgradeNetwork
{
    public function __construct(private FindSharedNetwork $networks) {}

    /**
     * Puts both servers on one private network, so the rows never travel over the internet. A provider network such as
     * a Hetzner Cloud Network is preferred, and the network of an existing cluster is reused. Returns false while the
     * memberships are still being applied.
     */
    public function prepare(DatabaseUpgrade $upgrade): bool
    {
        $source = $upgrade->source;
        $target = $upgrade->target;

        if ($upgrade->network === null) {
            $this->choose($upgrade, $source, $target);
        }

        $network = $upgrade->network;

        if ($this->networks->memberStatus($network, $target) === null) {
            $joined = match (true) {
                $network->type === NetworkType::PROVIDER => app(AttachProviderNetwork::class)->attach($source, $target, $this->name($upgrade), $network) !== null,
                FindSharedNetwork::canAddServers($network) => app(AddServersToNetwork::class)->add($network, ['servers' => [$target->id]]) !== false,
                default => false,
            };

            if (! $joined) {
                throw new RuntimeException(__('Vito could not put :server on the private network :network: both servers must be at the same provider, account and network zone.', [
                    'server' => $target->name,
                    'network' => $network->name,
                ]));
            }
        }

        foreach ([$source, $target] as $server) {
            $status = $this->networks->memberStatus($network, $server);

            if ($status === NetworkServerStatus::FAILED) {
                throw new RuntimeException(__('Connecting :server to the private network :network failed. Check the network logs.', [
                    'server' => $server->name,
                    'network' => $network->name,
                ]));
            }

            if ($status !== NetworkServerStatus::ACTIVE || $upgrade->address($server) === null) {
                return false;
            }
        }

        if ($network->type === NetworkType::PROVIDER) {
            foreach ([$source, $target] as $server) {
                $server->ssh()->exec(view('ssh.postgres-cluster.private-interface', ['address' => $upgrade->address($server)]), 'postgres-private-interface');
            }
        }

        $upgrade->update(['configuration' => [
            ...($upgrade->configuration ?? []),
            'source_address' => $upgrade->address($source),
            'target_address' => $upgrade->address($target),
        ]]);

        return true;
    }

    /**
     * Removes a WireGuard network Vito created only for this upgrade.
     */
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
        $network ??= $this->createWireGuard($upgrade, $source, $target);

        $upgrade->update(['network_id' => $network->id, 'owns_network' => $owns]);
        $upgrade->setRelation('network', $network);
    }

    private function createWireGuard(DatabaseUpgrade $upgrade, Server $source, Server $target): Network
    {
        $network = app(CreateNetwork::class)->create($source->project, [
            'name' => 'pg-upgrade-'.$upgrade->id,
            'type' => 'wireguard',
            'servers' => [$source->id, $target->id],
        ]);
        $network->firewallRules()->where('name', 'Allow all')->get()->each(fn ($rule) => app(ManageNetworkFirewallRule::class)->delete($rule));

        return $network;
    }

    private function name(DatabaseUpgrade $upgrade): string
    {
        return 'vito-pg-upgrade-'.$upgrade->id;
    }
}
