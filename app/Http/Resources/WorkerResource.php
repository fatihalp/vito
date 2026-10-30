<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class WorkerResource extends JsonResource
{
    
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'server_id' => $this->server_id,
            'site_id' => $this->site_id,
            'user_id' => $this->user_id,
            'created_by' => $this->creator?->name,
            'creator' => $this->creator ? [
                'id' => $this->creator->id,
                'name' => $this->creator->name,
                'email' => $this->creator->email,
            ] : null,
            'name' => $this->name,
            'command' => $this->command,
            'directory' => $this->directory,
            'user' => $this->user,
            'auto_start' => $this->auto_start,
            'auto_restart' => $this->auto_restart,
            'numprocs' => $this->numprocs,
            'status' => $this->status->getText(),
            'status_color' => $this->status->getColor(),
            'error' => $this->error,
            'is_site_bootstrap' => $this->isSiteBootstrap(),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
