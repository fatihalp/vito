<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RuntimeProcessResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'label' => $this->label,
            'driver' => $this->driver,
            'runtime_name' => $this->runtime_name,
            'kind' => $this->kind,
            'status' => $this->status->value,
            'status_label' => $this->status->getText(),
            'details' => $this->details ?? [],
            'last_checked_at' => $this->last_checked_at?->toIso8601String(),
            'sites' => $this->whenLoaded('sites', fn () => $this->sites->map(fn ($site) => ['id' => $site->id, 'domain' => $site->domain])),
        ];
    }
}
