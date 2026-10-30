<?php

namespace App\ServerProviders;


interface ProvidesPrivateNetworks
{
    
    public function instanceIdKey(): string;

    
    public function canDiscoverPrivateNetworks(array $regions, int $serversWithoutRegion): bool;

    
    public function privateNetworks(array $instanceIds, array $regions): array;
}
