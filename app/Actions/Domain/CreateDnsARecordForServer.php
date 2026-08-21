<?php

namespace App\Actions\Domain;

use App\Models\DNSProvider;
use App\Models\Domain;
use App\Models\Server;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Throwable;

class CreateDnsARecordForServer
{
    
    public function createIfRequested(Server $server, string $domainName, array $input): void
    {
        if (empty($input['create_dns_record']) || empty($input['dns_provider_id']) || empty($input['provider_domain_id'])) {
            return;
        }

        $dnsProvider = DNSProvider::find($input['dns_provider_id']);
        if (! $dnsProvider) {
            return;
        }

        if (auth()->check() && user()->cannot('update', $dnsProvider)) {
            throw ValidationException::withMessages([
                'dns_provider_id' => ['Unauthorized access to DNS provider.'],
            ]);
        }

        if (empty($server->ip)) {
            return;
        }

        $domain = Domain::where('dns_provider_id', $dnsProvider->id)
            ->where('provider_domain_id', (string) $input['provider_domain_id'])
            ->first();

        if (! $domain) {
            $domain = $this->addDomain($dnsProvider, $server, (string) $input['provider_domain_id']);
        }

        if (! $domain) {
            return;
        }

        try {
            app(CreateDNSRecord::class)->create($domain, [
                'type' => 'A',
                'name' => $domainName,
                'content' => $server->ip,
                'ttl' => 1,
                'proxied' => (bool) ($input['dns_record_proxied'] ?? false),
            ]);
        } catch (ValidationException $e) {
            if (str_contains(strtolower($e->getMessage()), 'already exists')) {
                Log::info("DNS record for {$domainName} already exists on provider, proceeding.");

                return;
            }
            throw $e;
        }
    }

    
    private function addDomain(DNSProvider $dnsProvider, Server $server, string $providerDomainId): ?Domain
    {
        try {
            return app(AddDomain::class)->add($dnsProvider->user, $server->project, [
                'dns_provider_id' => $dnsProvider->id,
                'provider_domain_id' => $providerDomainId,
            ]);
        } catch (Throwable) {
            return null;
        }
    }
}
