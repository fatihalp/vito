<?php

namespace App\Http\Resources;

use App\Models\BackupRestore;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin BackupRestore */
class BackupRestoreResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'backup_id' => $this->backup_id,
            'backup_file_name' => $this->file?->name,
            'server_id' => $this->server_id,
            'server_name' => $this->server?->name,
            'target' => $this->target,
            'target_time' => $this->target_time,
            'status' => $this->status->getText(),
            'status_color' => $this->status->getColor(),
            'active' => in_array($this->status->value, ['waiting_for_server', 'restoring'], true),
            'step' => $this->step,
            'message' => $this->message,
            'finished_at' => $this->finished_at,
            'created_at' => $this->created_at,
        ];
    }
}
