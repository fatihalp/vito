<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BackupMonitorResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $configuration = $this->configuration ?? [];
        $details = $this->details ?? [];
        $canRun = $this->report_server_id !== null && ($request->user()?->can('run', [$this->resource, $this->server]) ?? false);

        return [
            'id' => $this->id,
            'server_id' => $this->server_id,
            'server_name' => $this->server?->name,
            'label' => $this->label,
            'status' => $this->status->value,
            'status_color' => $this->status->getColor(),
            'last_checked_at' => $this->last_checked_at?->toIso8601String(),
            'last_task' => $this->last_task,
            'task_state' => $this->task_state,
            'task_requested_at' => $this->task_requested_at?->toIso8601String(),
            'details' => array_intersect_key($details, array_flip(['last_success_at', 'restore_state', 'restore_verified_at', 'snapshots', 'error_code'])),
            'can_run_backup' => $canRun && ! empty($configuration['backup_unit']),
            'can_run_verify' => $canRun && ! empty($configuration['verify_unit']),
            'can_delete' => $request->user()?->can('delete', [$this->resource, $this->server]) ?? false,
        ];
    }
}
