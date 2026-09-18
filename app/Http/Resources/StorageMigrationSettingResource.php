<?php

namespace App\Http\Resources;

use App\Models\StorageMigrationSetting;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class StorageMigrationSettingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'max_processes' => $this->max_processes,
            'scan_max_processes' => $this->scan_max_processes,
            'applied_max_processes' => $this->applied_max_processes,
            'applied_scan_max_processes' => $this->applied_scan_max_processes,
            'applied_at' => $this->applied_at,
            'needs_apply' => $this->needsApply(),
            'max_allowed_processes' => (int) config('storage-migration.max_allowed_processes', 10),
        ];
    }
}
