<?php

namespace App\Http\Resources;

use App\Models\NetworkServer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class NetworkServerResource extends JsonResource
{
    
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'network_id' => $this->network_id,
            'server_id' => $this->server_id,
            'server_name' => $this->whenLoaded('server', fn (): string => $this->server->name),
            'network' => $this->whenLoaded('network', fn (): array => [
                'id' => $this->network->id,
                'name' => $this->network->name,
                'type' => $this->network->type->value,
                'kind' => $this->network->kind(),
                'cidr' => $this->network->cidr,
            ]),
            'ip' => $this->ip,
            'private_ip' => $this->whenLoaded('serverIpAddress', fn (): ?string => $this->serverIpAddress?->ip),
            'public_key' => $this->public_key,
            'last_handshake_at' => $this->last_handshake_at,
            'connected' => $this->connected(),
            'status' => $this->status->getText(),
            'status_color' => $this->status->getColor(),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
