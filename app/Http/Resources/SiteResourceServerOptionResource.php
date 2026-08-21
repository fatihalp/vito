<?php

namespace App\Http\Resources;

use App\Models\Server;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;


class SiteResourceServerOptionResource extends JsonResource
{
    
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'ip' => $this->ip,
            'role' => $this->role->getText(),
            'role_value' => $this->role->value,
            'role_color' => $this->role->getColor(),
            'has_database' => (bool) $this->database(),
            'has_cache' => (bool) $this->memoryDatabase(),
        ];
    }
}
