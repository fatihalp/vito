<?php

namespace App\Http\Resources;

use App\Enums\NetworkType;
use App\Models\NetworkServer;
use App\Models\PostgresCluster;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin PostgresCluster */
class PostgresClusterResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'stanza' => $this->stanza,
            'status' => $this->status->getText(),
            'status_color' => $this->status->getColor(),
            'primary_server_id' => $this->primary_server_id,
            'primary_server_name' => $this->primary?->name,
            'network' => $this->network ? [
                'id' => $this->network->id,
                'name' => $this->network->name,
                'type' => $this->network->type->value,
                'kind' => $this->network->kind(),
                'managed' => $this->owns_network,
                'cidr' => $this->network->cidr,
                'nodes' => $this->network->servers()
                    ->whereIn('server_id', $this->nodes()->pluck('id'))
                    ->with('server', 'serverIpAddress')
                    ->get()
                    ->map(fn (NetworkServer $member): array => [
                        'server_id' => $member->server_id,
                        'name' => $member->server->name,
                        'role' => $member->server_id === $this->primary_server_id ? 'primary' : 'replica',
                        'ip' => $member->address(),
                        'status' => $member->status->getText(),
                        'connected' => $this->network->type === NetworkType::WIREGUARD ? $member->connected() : null,
                        'last_handshake_at' => $member->last_handshake_at,
                    ])
                    ->values(),
            ] : null,
            'backup' => $this->backup ? BackupResource::make($this->backup) : null,
            'tls_expires_at' => $this->tls['nodes'][$this->primary_server_id]['expires_at'] ?? null,
            'backups_from_replicas' => isset($this->tls['server_installed_at']),
            'failover_enabled' => (bool) config('database-replication.failover_enabled'),
            'failover' => $this->failover ? [
                'step' => $this->failover['step'],
                'error' => $this->failover['error'] ?? null,
                'force' => (bool) ($this->failover['force'] ?? false),
                'new_primary_server_id' => $this->failover['server_id'],
                'started_at' => $this->failover['started_at'] ?? null,
            ] : null,
        ];
    }
}
