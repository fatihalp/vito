<?php

namespace App\Http\Resources;

use App\Models\DatabaseUpgrade;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin DatabaseUpgrade */
class DatabaseUpgradeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'source_server_id' => $this->source_server_id,
            'source_server_name' => $this->source?->name,
            'target_server_id' => $this->target_server_id,
            'target_server_name' => $this->target?->name,
            'source_version' => $this->source_version,
            'target_version' => $this->target_version,
            'state' => $this->status->value,
            'status' => $this->status->getText(),
            'status_color' => $this->status->getColor(),
            'active' => $this->status->isActive(),
            'busy' => $this->status->isBusy(),
            'step' => $this->step,
            'message' => $this->message,
            'progress' => $this->progress(),
            'databases' => $this->databases(),
            'lag_bytes' => $this->configuration['lag_bytes'] ?? null,
            'restart_needed' => (bool) ($this->preflight['restart_needed'] ?? false),
            'warnings' => $this->preflight['warnings'] ?? [],
            'network' => $this->network === null ? null : [
                'name' => $this->network->name,
                'kind' => $this->network->kind(),
                'type' => $this->network->type->value,
            ],
            'events' => array_slice($this->events ?? [], -100),
            'caught_up_at' => $this->caught_up_at,
            'finished_at' => $this->finished_at,
            'created_at' => $this->created_at,
        ];
    }
}
