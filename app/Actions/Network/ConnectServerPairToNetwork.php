<?php

namespace App\Actions\Network;

use App\Enums\NetworkServerStatus;
use App\Enums\NetworkType;
use App\Models\Network;
use App\Models\Server;
use RuntimeException;

class ConnectServerPairToNetwork
{
    public function __construct(private FindSharedNetwork $networks) {}

    public function join(Network $network, Server $member, Server $joining, string $providerNetworkName): bool
    {
        if ($this->networks->memberStatus($network, $joining) !== null) {
            return true;
        }

        if ($network->type === NetworkType::PROVIDER) {
            return app(AttachProviderNetwork::class)->attach($member, $joining, $providerNetworkName, $network) !== null;
        }

        if (! FindSharedNetwork::canAddServers($network)) {
            return false;
        }

        app(AddServersToNetwork::class)->add($network, ['servers' => [$joining->id]]);

        return true;
    }

    public function ready(Network $network, Server $first, Server $second): bool
    {
        foreach ([$first, $second] as $server) {
            $status = $this->networks->memberStatus($network, $server);

            if ($status === NetworkServerStatus::FAILED) {
                throw new RuntimeException(__('Connecting :server to the private network :network failed. Check the network logs.', [
                    'server' => $server->name,
                    'network' => $network->name,
                ]));
            }

            if ($status !== NetworkServerStatus::ACTIVE || $this->networks->address($network, $server) === null) {
                return false;
            }
        }

        if ($network->type === NetworkType::PROVIDER) {
            foreach ([$first, $second] as $server) {
                $server->ssh()->exec(view('ssh.postgres-cluster.private-interface', ['address' => $this->networks->address($network, $server)]), 'postgres-private-interface');
            }
        }

        return true;
    }

    public function createWireGuard(string $name, Server $first, Server $second): Network
    {
        return app(CreateNetwork::class)->create($first->project, [
            'name' => $name,
            'type' => 'wireguard',
            'servers' => [$first->id, $second->id],
        ], seedDefaultFirewallRule: false);
    }
}
