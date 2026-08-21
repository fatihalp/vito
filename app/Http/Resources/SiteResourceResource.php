<?php

namespace App\Http\Resources;

use App\Models\SiteResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;


class SiteResourceResource extends JsonResource
{
    
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'site_id' => $this->site_id,
            'type' => $this->type->getText(),
            'type_value' => $this->type->value,
            'type_color' => $this->type->getColor(),
            'status' => $this->status->getText(),
            'status_color' => $this->status->getColor(),
            'server' => $this->server ? [
                'id' => $this->server->id,
                'name' => $this->server->name,
                'ip' => $this->server->ip,
                'local_ip' => $this->server->local_ip,
                'role' => $this->server->role->getText(),
            ] : null,
            'bucket' => $this->bucket ? new BucketResource($this->bucket) : null,
            'environment' => $this->environment,
            'environment_keys' => array_keys($this->environment),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
