<?php

namespace App\Http\Resources;

use App\Models\Bucket;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Bucket */
class BucketResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'name' => $this->name,
            'driver' => $this->driver,
            'endpoint' => $this->configuration['endpoint'],
            'region' => $this->configuration['region'],
            'bucket' => $this->configuration['bucket'],
            'path_style' => (bool) ($this->configuration['path_style'] ?? false),
            'visibility' => $this->configuration['visibility'] ?? 'private',
            'allowed_origins' => $this->configuration['allowed_origins'] ?? [],
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
