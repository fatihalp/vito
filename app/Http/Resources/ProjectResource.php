<?php

namespace App\Http\Resources;

use App\Models\Project;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectResource extends JsonResource
{
    
    public function toArray(Request $request): array
    {
        
        $user = $request->user();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'role' => $user ? $this->role($user)?->value : null,
            'servers_count' => (int) ($this->servers_count ?? ($this->relationLoaded('servers') ? $this->servers->count() : $this->servers()->count())),
            'sites_count' => (int) ($this->sites_count ?? ($this->relationLoaded('sites') ? $this->sites->count() : $this->sites()->count())),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
            'users' => ProjectUserResource::collection($this->whenLoaded('users')),
        ];
    }
}
