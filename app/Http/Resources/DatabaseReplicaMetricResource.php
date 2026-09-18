<?php

namespace App\Http\Resources;

use App\Models\DatabaseReplicaMetric;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin DatabaseReplicaMetric */
class DatabaseReplicaMetricResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'date' => $this->created_at,
            'health' => $this->health->getText(),
            'health_color' => $this->health->getColor(),
            'state' => $this->state,
            'lag_bytes' => $this->lag_bytes,
            'replay_delay_seconds' => $this->replay_delay_seconds,
            'write_lag_ms' => $this->write_lag_ms,
            'flush_lag_ms' => $this->flush_lag_ms,
            'replay_lag_ms' => $this->replay_lag_ms,
            'slot_retained_bytes' => $this->slot_retained_bytes,
            'slot_wal_status' => $this->slot_wal_status,
        ];
    }
}
