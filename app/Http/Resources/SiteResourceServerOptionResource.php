<?php

namespace App\Http\Resources;

use App\Enums\ServiceStatus;
use App\Models\Server;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SiteResourceServerOptionResource extends JsonResource
{

    public function toArray(Request $request): array
    {
        $database = $this->database();
        $cache = $this->memoryDatabase();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'ip' => $this->ip,
            'role' => $this->role->getText(),
            'role_value' => $this->role->value,
            'role_color' => $this->role->getColor(),
            'has_database' => $database?->status === ServiceStatus::READY,
            'has_cache' => $cache?->status === ServiceStatus::READY,
            'database_status' => $database?->status->getText(),
            'cache_status' => $cache?->status->getText(),
        ];
    }
}
