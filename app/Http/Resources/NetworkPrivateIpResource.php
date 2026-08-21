<?php

namespace App\Http\Resources;

use App\Models\ServerIpAddress;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;


class NetworkPrivateIpResource extends JsonResource
{
    
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'ip' => $this->ip,
            'is_primary' => $this->is_primary,
        ];
    }
}
