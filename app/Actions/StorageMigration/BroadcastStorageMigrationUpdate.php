<?php

namespace App\Actions\StorageMigration;

use App\DTOs\SocketEventDTO;
use App\Events\SocketEvent;
use App\Http\Resources\StorageMigrationResource;
use App\Models\StorageMigration;

class BroadcastStorageMigrationUpdate
{
    public function broadcast(StorageMigration $storageMigration): void
    {
        $storageMigration->refresh()->load('source', 'target')->withProcessingCount();

        SocketEvent::dispatch(new SocketEventDTO(
            projectId: $storageMigration->project_id,
            type: 'storage-migration.updated',
            data: new StorageMigrationResource($storageMigration),
        ));
    }
}
