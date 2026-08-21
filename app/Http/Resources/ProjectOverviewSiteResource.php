<?php

namespace App\Http\Resources;

use App\Models\Site;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;


class ProjectOverviewSiteResource extends JsonResource
{
    
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'server_id' => $this->server_id,
            'domain' => $this->domain,
            'server_name' => $this->server->name,
            'status' => $this->status->getText(),
            'status_color' => $this->status->getColor(),
            'warnings' => $this->getWarnings(),
        ];
    }
}
