<?php

namespace App\Http\Resources;

use App\Models\EnvVersion;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin EnvVersion */
class EnvVersionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'site_id' => $this->site_id,
            'path' => $this->path,
            'source' => $this->source->getText(),
            'source_color' => $this->source->getColor(),
            'user_name' => $this->user?->name,
            'restored_from_id' => $this->restored_from_id,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
