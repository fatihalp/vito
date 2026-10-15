<?php

namespace App\ServerProviders;

interface AttachesPrivateNetworks extends ProvidesPrivateNetworks
{
    /**
     * @param  list<string>  $instanceIds
     * @return array{id: string, managed: bool}|null
     */
    public function attachPrivateNetwork(array $instanceIds, string $name, ?string $networkId = null): ?array;
}
