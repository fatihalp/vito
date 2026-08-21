<?php

namespace App\ServerProviders;

use App\DTOs\PrivateNetworkDTO;
use App\Exceptions\PrivateNetworkSyncError;


interface ProvidesPrivateNetworks
{
    
    public function instanceIdKey(): string;

    
    public function canDiscoverPrivateNetworks(array $regions, int $serversWithoutRegion): bool;

    
    public function privateNetworks(array $instanceIds, array $regions): array;
}
