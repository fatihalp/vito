<?php

namespace App\Http\Resources;

use App\Models\Redirect;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RedirectResource extends JsonResource
{
    
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'server_id' => $this->site->server_id,
            'site_id' => $this->site_id,
            'from' => $this->from,
            'to' => $this->to,
            'mode' => $this->mode,
            'websocket' => (bool) $this->websocket,
            'status' => $this->status->getText(),
            'status_color' => $this->status->getColor(),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
