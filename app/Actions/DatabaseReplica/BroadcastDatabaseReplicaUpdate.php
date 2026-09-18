<?php

namespace App\Actions\DatabaseReplica;

use App\DTOs\SocketEventDTO;
use App\Events\SocketEvent;
use App\Http\Resources\DatabaseReplicaResource;
use App\Models\DatabaseReplica;

class BroadcastDatabaseReplicaUpdate
{
    public function broadcast(DatabaseReplica $replica): void
    {
        $replica->refresh()->load('cluster.primary', 'replica', 'latestMetric');

        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $replica->primary->project_id,
            type: 'database-replica.updated',
            data: new DatabaseReplicaResource($replica),
        ));
    }
}
