<?php

namespace App\Http\Resources;

use App\Models\DatabaseReplica;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin DatabaseReplica */
class DatabaseReplicaResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'postgres_cluster_id' => $this->postgres_cluster_id,
            'primary_server_id' => $this->cluster?->primary_server_id,
            'primary_server_name' => $this->cluster?->primary?->name,
            'replica_server_id' => $this->replica_server_id,
            'replica_server_name' => $this->replica?->name,
            'status' => $this->status->getText(),
            'status_color' => $this->status->getColor(),
            'health' => $this->health->getText(),
            'health_color' => $this->health->getColor(),
            'health_reasons' => $this->health_reasons ?? [],
            'private_address' => $this->cluster?->address($this->replica),
            'slot_name' => $this->slot_name,
            'username' => $this->username,
            'max_slot_wal_keep_size_gb' => $this->max_slot_wal_keep_size_gb,
            'progress' => $this->progress,
            'message' => $this->message,
            'latest_metric' => $this->whenLoaded('latestMetric', fn () => $this->latestMetric ? DatabaseReplicaMetricResource::make($this->latestMetric) : null),
            'setup_step' => $this->configuration['setup_step'] ?? null,
            'last_checked_at' => $this->last_checked_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
