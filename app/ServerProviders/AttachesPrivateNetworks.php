<?php

namespace App\ServerProviders;

interface AttachesPrivateNetworks extends ProvidesPrivateNetworks
{
    /**
     * Puts the instances on one private network at the provider: $networkId when given, else a network one of them is
     * already on, else a new one. Returns the network's external id and whether Vito created it (now or earlier), or
     * null when the instances cannot share it (another network zone).
     *
     * @param  list<string>  $instanceIds
     * @return array{id: string, managed: bool}|null
     */
    public function attachPrivateNetwork(array $instanceIds, string $name, ?string $networkId = null): ?array;
}
