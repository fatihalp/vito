<?php

namespace App\Services;


interface SupportsNetworkingSecret extends SupportsNetworking
{
    public function generateNetworkingSecret(): string;

    
    public function writeNetworkingSecret(?string $secret): void;
}
