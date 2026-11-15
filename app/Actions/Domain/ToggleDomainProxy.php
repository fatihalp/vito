<?php

namespace App\Actions\Domain;

use App\Models\DNSRecord;
use App\Models\Domain;
use App\Models\Site;
use Illuminate\Validation\ValidationException;

class ToggleDomainProxy
{
    public function toggle(Site $site, string $domainName, ?bool $proxied = null): bool
    {
        $domainName = strtolower(trim($domainName));
        $server = $site->server;
        $serverIp = $server->ip;

        $domain = $this->findMatchingDomain($domainName, $server->project_id);
        $dnsRecord = $this->findDnsRecord($domainName, $server->project_id, $domain);

        if ($dnsRecord) {
            $targetProxied = $proxied ?? (! $dnsRecord->proxied);

            app(UpdateDNSRecord::class)->update($dnsRecord, [
                'type' => $dnsRecord->type,
                'name' => $dnsRecord->name,
                'content' => $serverIp ?: $dnsRecord->content,
                'ttl' => 1,
                'proxied' => $targetProxied,
                'priority' => $dnsRecord->priority,
            ]);

            return $targetProxied;
        }

        if (! $domain || ! $serverIp) {
            throw ValidationException::withMessages([
                'domain' => ["Could not find a DNS zone for '{$domainName}' among this project's domains. Add the zone under Domains first."],
            ]);
        }

        return app(CreateDNSRecord::class)->create($domain, [
            'type' => 'A',
            'name' => $domainName,
            'content' => $serverIp,
            'ttl' => 1,
            'proxied' => $proxied ?? true,
        ])->proxied;
    }

    private function findMatchingDomain(string $domainName, int $projectId): ?Domain
    {
        return Domain::query()
            ->where('project_id', $projectId)
            ->whereHas('dnsProvider', fn ($query) => $query->where('connected', true))
            ->get()
            ->filter(fn (Domain $domain): bool => $domainName === strtolower($domain->domain) || str_ends_with($domainName, '.'.strtolower($domain->domain)))
            ->sortByDesc(fn (Domain $domain): int => strlen($domain->domain))
            ->first();
    }

    private function findDnsRecord(string $domainName, int $projectId, ?Domain $domain): ?DNSRecord
    {
        $exact = DNSRecord::query()
            ->where('type', 'A')
            ->where('name', $domainName)
            ->whereHas('domain', fn ($query) => $query
                ->where('project_id', $projectId)
                ->whereHas('dnsProvider', fn ($query) => $query->where('connected', true)))
            ->first();

        if ($exact || ! $domain) {
            return $exact;
        }

        return $domain->records()
            ->where('type', 'A')
            ->where('name', substr($domainName, 0, -strlen('.'.$domain->domain)) ?: '@')
            ->first();
    }
}
