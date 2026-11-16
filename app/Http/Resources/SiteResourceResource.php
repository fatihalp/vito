<?php

namespace App\Http\Resources;

use App\Helpers\EnvParser;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SiteResourceResource extends JsonResource
{
    
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'site_id' => $this->site_id,
            'type' => $this->type->getText(),
            'type_value' => $this->type->value,
            'type_color' => $this->type->getColor(),
            'management_mode' => $this->configuration['management_mode'] ?? 'managed',
            'status' => $this->status->getText(),
            'status_color' => $this->status->getColor(),
            'server' => $this->server ? [
                'id' => $this->server->id,
                'name' => $this->server->name,
                'ip' => $this->server->ip,
                'local_ip' => $this->server->local_ip,
                'role' => $this->server->role->getText(),
            ] : null,
            'storage_provider' => $this->storageProvider ? new StorageProviderResource($this->storageProvider) : null,
            'environment' => collect($this->environment)->mapWithKeys(fn ($value, string $key): array => [
                $key => EnvParser::isSecretKey($key) ? '••••••••' : $value,
            ])->all(),
            'environment_keys' => array_keys($this->environment),
            'secrets_redacted' => true,
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
