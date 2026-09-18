<?php

namespace App\Http\Resources;

use App\Enums\BackupType;
use App\Models\Backup;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BackupResource extends JsonResource
{
    
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'server_id' => $this->server_id,
            'storage_id' => $this->storage_id,
            'storage' => StorageProviderResource::make($this->storage),
            'database_id' => $this->database_id,
            'database' => $this->database ? DatabaseResource::make($this->database) : null,
            'path' => $this->path,
            'type' => $this->type,
            'keep_backups' => $this->keep_backups,
            'interval' => $this->interval,
            'files_count' => $this->files_count,
            'status' => $this->status?->getText(),
            'status_color' => $this->status?->getColor(),
            'enabled' => $this->enabled,
            'last_file' => BackupFileResource::make($this->whenLoaded('lastFile')),
            'problems' => array_values($this->health['problems'] ?? []),
            'pgbackrest' => $this->type === BackupType::PGBACKREST ? [
                'stanza' => $this->cluster?->stanza,
                'cluster_id' => $this->cluster?->id,
                'strategy' => $this->configuration['strategy'] ?? null,
                'schedules' => $this->configuration['schedules'] ?? null,
                'retention' => $this->configuration['retention'] ?? null,
                'verify_schedule' => $this->configuration['verify_schedule'] ?? null,
                'last_verified_at' => $this->configuration['last_verified_at'] ?? null,
                'last_verify_result' => $this->configuration['last_verify_result'] ?? null,
                'last_checked_at' => $this->configuration['last_checked_at'] ?? null,
                'last_check_result' => $this->configuration['last_check_result'] ?? null,
                'process_max' => $this->configuration['process_max'] ?? null,
                'wal_queue_max_gb' => $this->configuration['wal_queue_max_gb'] ?? null,
            ] : null,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
