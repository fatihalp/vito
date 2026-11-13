<?php

namespace App\Models;

use App\Enums\BackupMonitorStatus;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BackupMonitor extends AbstractModel
{
    protected $fillable = ['server_id', 'report_server_id', 'label', 'configuration', 'status', 'details', 'last_checked_at', 'last_alert_status', 'last_alert_requested_at', 'last_task', 'task_state', 'task_requested_at'];

    protected $attributes = ['status' => 'unknown'];

    protected $casts = ['server_id' => 'integer', 'report_server_id' => 'integer', 'configuration' => 'encrypted:json', 'status' => BackupMonitorStatus::class, 'details' => 'array', 'last_checked_at' => 'datetime', 'last_alert_requested_at' => 'datetime', 'task_requested_at' => 'datetime'];

    protected $hidden = ['configuration'];

    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    public function reportServer(): BelongsTo
    {
        return $this->belongsTo(Server::class, 'report_server_id');
    }
}
