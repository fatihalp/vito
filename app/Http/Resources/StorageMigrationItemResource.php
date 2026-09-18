<?php

namespace App\Http\Resources;

use App\Models\StorageMigrationItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StorageMigrationItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'backup_file_id' => $this->backup_file_id,
            'source_key' => $this->source_key,
            'target_key' => $this->target_key,
            'size' => $this->size,
            'copied_bytes' => $this->copied_bytes,
            'status' => $this->status->getText(),
            'status_color' => $this->status->getColor(),
            'attempts' => $this->attempts,
            'error' => $this->error,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
