<?php

namespace App\Http\Resources;

use App\Models\Server;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectOverviewServerResource extends JsonResource
{
    
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'name' => $this->name,
            'ip' => $this->ip,
            'status' => $this->status->getText(),
            'status_color' => $this->status->getColor(),
            'warnings' => $this->getWarnings(),
            'counts' => [
                'cronjobs' => (int) ($this->cron_jobs_count ?? $this->cronJobs()->count()),
                'services' => (int) ($this->services_count ?? $this->services()->count()),
                'backups' => (int) ($this->backups_count ?? $this->backups()->count()),
            ],
        ];
    }
}
