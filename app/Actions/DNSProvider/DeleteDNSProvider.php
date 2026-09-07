<?php

namespace App\Actions\DNSProvider;

use App\DTOs\SocketEventDTO;
use App\Events\SocketEvent;
use App\Models\DNSProvider;
use Illuminate\Validation\ValidationException;

class DeleteDNSProvider
{
    public function delete(DNSProvider $dnsProvider): void
    {
        if ($dnsProvider->domains()->exists()) {
            throw ValidationException::withMessages([
                'provider' => __('This DNS provider is being used by a domain.'),
            ]);
        }

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
