<?php

namespace App\Http\Resources;

use App\Models\DeploymentScript;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DeploymentScriptResource extends JsonResource
{
    
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'site_id' => $this->site_id,
            'name' => $this->name,
            'content' => $this->content,
            'configs' => [
                'restart_workers' => $this->shouldRestartWorkers(),
            ],
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
