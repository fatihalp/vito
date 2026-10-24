<?php

namespace App\Actions\DNSProvider;

use App\DTOs\SocketEventDTO;
use App\Events\SocketEvent;
use App\Models\DNSProvider;

class DeleteDNSProvider
{
    public function delete(DNSProvider $dnsProvider): void
    {
        $id = $dnsProvider->id;
        $projectId = $dnsProvider->project_id ?? 0;

        $dnsProvider->delete();

        SocketEvent::dispatch(new SocketEventDTO(
            $projectId,
            'dns-provider.deleted',
            ['id' => $id],
        ));
    }
}
