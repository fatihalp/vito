<?php

namespace App\Actions\Network;

use App\Models\Network;
use App\Models\Server;
use App\ServerProviders\AttachesPrivateNetworks;
use RuntimeException;

class AttachProviderNetwork
{
    /**
     * Asks the provider both servers run at to attach them to one private network, an existing one when it is given,
     * and returns that network as Vito knows it. Null when the servers are not at the same provider, or it cannot.
     */
    public function attach(Server $first, Server $second, string $name, ?Network $into = null): ?Network
    {
        $provider = $first->provider_id !== null && $first->provider_id === $second->provider_id ? $first->serverProvider?->provider() : null;

        if (! $provider instanceof AttachesPrivateNetworks) {
            return null;
        }

        $ids = collect([$first, $second])->map(fn (Server $server): string => (string) ($server->provider_data[$provider->instanceIdKey()] ?? ''));
        $attached = $ids->contains('') ? null : $provider->attachPrivateNetwork($ids->all(), $name, $into?->external_id);

        if ($attached === null) {
            return null;
        }

        app(SyncProviderNetworks::class)->forProject($first->project);

        $network = $first->project->networks()->where('server_provider_id', $first->provider_id)->where('external_id', $attached['id'])->first()
            ?? throw new RuntimeException(__('The provider attached both servers to a private network, but Vito could not load it. Sync the networks on the Networks page and retry.'));

        if ($attached['managed']) {
            $network->firewallRules()->where('name', 'Allow all')->get()->each(fn ($rule) => app(ManageNetworkFirewallRule::class)->delete($rule));
        }

        return $network;
    }
}
