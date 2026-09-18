<?php

namespace App\Http\Resources;

use App\Models\StorageMigration;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StorageMigrationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'project_id' => $this->project_id,
            'source_storage_id' => $this->source_storage_id,
            'source' => StorageProviderResource::make($this->whenLoaded('source')),
            'target_storage_id' => $this->target_storage_id,
            'target' => StorageProviderResource::make($this->whenLoaded('target')),
            'overwrite' => $this->overwrite,
            'worker_count' => $this->worker_count,
            'max_worker_count' => (int) config('storage-migration.max_allowed_processes', 10),
            'worker_capacity' => (int) config('horizon.defaults.storage-migration.maxProcesses', 1),
            'items_processing' => (int) ($this->items_processing ?? 0),
            'status' => $this->status->getText(),
            'status_color' => $this->status->getColor(),
            'progress' => $this->progress(),
            'syncing' => $this->isSyncing(),
            'last_activity_at' => $this->last_activity_at,
            'items_total' => $this->items_total,
            'items_copied' => $this->items_copied,
            'items_skipped' => $this->items_skipped,
            'items_failed' => $this->items_failed,
            'bytes_total' => $this->bytes_total,
            'bytes_copied' => $this->bytes_copied,
            'error' => $this->error,
            'started_at' => $this->started_at,
            'scan_completed_at' => $this->scan_completed_at,
            'target_scan_completed_at' => $this->target_scan_completed_at,
            'scan_paused' => $this->scan_paused,
            'transfer_paused' => $this->transfer_paused,
            'finished_at' => $this->finished_at,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
