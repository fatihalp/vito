<?php

namespace App\Http\Resources;

use App\Models\Server;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;


class NetworkServerOptionResource extends JsonResource
{
    
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'is_ready' => $this->isReady(),
            'private_ips' => NetworkPrivateIpResource::collection($this->whenLoaded('ipAddresses')),
        ];
    }
}
