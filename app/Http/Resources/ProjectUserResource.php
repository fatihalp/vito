<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectUserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $displayName = $this->name ?? $this->user?->name;
        $displayEmail = $this->email ?? $this->user?->email;

        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'project_id' => $this->project_id,
            'project_name' => $this->project->name ?? null,
            'name' => $displayName ?: $displayEmail,
            'email' => $displayEmail,
            'role' => $this->role?->getText(),
            'type' => $this->user_id ? 'user' : 'invitation',
        ];
    }
}
