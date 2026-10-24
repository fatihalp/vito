<?php

namespace App\Actions\Domain;

use RuntimeException;
use App\Models\DNSRecord;
use Illuminate\Validation\ValidationException;
use Throwable;

class DeleteDNSRecord
{
    
    public function delete(DNSRecord $dnsRecord): void
    {
        $provider = $dnsRecord->domain->dnsProvider->provider();

        try {
            if (! $provider->deleteRecord($dnsRecord->domain->provider_domain_id, $dnsRecord->provider_record_id)) {
                throw new RuntimeException(__('The DNS provider refused to delete this record. Check the provider logs and try again.'));
            }
        } catch (Throwable $e) {
            throw ValidationException::withMessages([
                'record' => [$e->getMessage()],
            ]);
        }

        $dnsRecord->delete();
    }
}
