<?php

namespace App\Models;

use App\DTOs\SocketEventDTO;
use App\Enums\WorkflowRunStatus;
use App\Events\SocketEvent;
use Database\Factories\WorkflowRunFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

class WorkflowRun extends Model
{
    public const string PENDING_LOG_MESSAGE = "This job hasn't started yet. It's queued and will begin automatically.";


    use HasFactory;

    protected $fillable = [
        'workflow_id',
        'user_id',
        'log_disk',
        'log_path',
        'current_node_id',
        'current_node_label',
        'status',
        'verbose',
    ];

    protected $casts = [
        'workflow_id' => 'integer',
        'user_id' => 'integer',
        'logs' => 'json',
        'status' => WorkflowRunStatus::class,
        'verbose' => 'boolean',
    ];

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(Workflow::class);
    }

    public function log(string $content): void
    {
        if (empty($this->log_disk) || empty($this->log_path)) {
            $this->log_disk = 'server-logs';
            $this->log_path = 'workflow_run_'.$this->id.'.log';
            $this->save();
        }

        $logEntry = '['.now()->toDateTimeString().'] '.PHP_EOL.$content.PHP_EOL;

        Storage::disk($this->log_disk)->append($this->log_path, $logEntry);

        $projectId = $this->workflow?->project_id;
        if ($projectId) {
            SocketEvent::dispatch(new SocketEventDTO(
                projectId: $projectId,
                type: 'workflow-run.log-content',
                data: [
                    'id' => $this->id,
                    'content' => $logEntry,
                ],
            ));
        }
    }

    public function getLogContent(): string
    {
        if (empty($this->log_disk) || empty($this->log_path) || ! Storage::disk($this->log_disk)->exists($this->log_path)) {
            return self::PENDING_LOG_MESSAGE;
        }

        return Storage::disk($this->log_disk)->get($this->log_path);
    }
}
