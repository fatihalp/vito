<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CommandExecutionResource extends JsonResource
{
    
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'command_id' => $this->command_id,
            'cron_job_id' => $this->cron_job_id,
            'server_id' => $this->server_id,
            'user_id' => $this->user_id,
            'server_log_id' => $this->server_log_id,
            'log' => ServerLogResource::make($this->serverLog),
            'variables' => array_fill_keys(array_keys((array) $this->variables), null),
            'status' => $this->status->getText(),
            'status_color' => $this->status->getColor(),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
