<?php

namespace App\Http\Resources;

use App\Models\WorkflowRun;
use App\Enums\WorkflowRunStatus;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin WorkflowRun */
class WorkflowRunResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $endedAt = $this->status === WorkflowRunStatus::RUNNING ? now() : $this->updated_at;
        $durationSeconds = $this->created_at ? (int) $this->created_at->diffInSeconds($endedAt ?? now(), true) : 0;

        return [
            'id' => $this->id,
            'workflow_id' => $this->workflow_id,
            'status' => $this->status->getText(),
            'status_color' => $this->status->getColor(),
            'current_node_label' => $this->current_node_label,
            'current_node_id' => $this->current_node_id,
            'duration' => $this->formatDuration($durationSeconds),
            'duration_seconds' => $durationSeconds,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }

    private function formatDuration(int $seconds): string
    {
        $hours = intdiv($seconds, 3600);
        $minutes = intdiv($seconds % 3600, 60);
        $remainingSeconds = $seconds % 60;

        if ($hours > 0) {
            return sprintf('%dh %02dm %02ds', $hours, $minutes, $remainingSeconds);
        }

        if ($minutes > 0) {
            return sprintf('%dm %02ds', $minutes, $remainingSeconds);
        }

        return $remainingSeconds.'s';
    }
}
