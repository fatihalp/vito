<?php

namespace App\Actions\Domain;

use App\Models\DNSProvider;
use App\Models\DNSRecord;
use App\Models\Domain;
use App\Models\Site;
use Exception;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class ToggleDomainProxy
{
    public function toggle(Site $site, string $domainName, ?bool $proxied = null): bool
    {
        $domainName = strtolower(trim($domainName));
        $server = $site->server;
        $serverIp = $server->ip;
        $projectId = $server->project_id;

        $dnsRecord = $this->findDnsRecord($domainName, $projectId);

        if (! $dnsRecord) {
            $dnsRecord = $this->findOrCreateViaMatchingDomain($domainName, $serverIp, $proxied, $projectId);
        }

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

        return $this->createViaCloudflareZoneScan($domainName, $serverIp, $proxied, $projectId);
    }

    private function findDnsRecord(string $domainName, int $projectId): ?DNSRecord
    {
        return DNSRecord::where('type', 'A')
            ->where('name', $domainName)
            ->whereHas('domain', function ($q) use ($projectId) {
                $q->where('project_id', $projectId)
                    ->whereHas('dnsProvider', fn ($q) => $q->where('connected', true));
            })
            ->first();
    }

    private function findOrCreateViaMatchingDomain(
        string $domainName,
        ?string $serverIp,
        ?bool $proxied,
        int $projectId,
    ): ?DNSRecord {
        $domains = Domain::where('project_id', $projectId)
            ->whereHas('dnsProvider', fn ($q) => $q->where('connected', true))
            ->get();

        foreach ($domains as $d) {
            $rootDomain = strtolower($d->domain);
            if ($domainName !== $rootDomain && ! str_ends_with($domainName, '.' . $rootDomain)) {
                continue;
            }

            $subdomain = $domainName === $rootDomain ? '@' : str_replace('.' . $rootDomain, '', $domainName);

            $dnsRecord = DNSRecord::where('domain_id', $d->id)
                ->where('type', 'A')
                ->where(function ($q) use ($domainName, $subdomain) {
                    $q->where('name', $domainName)
                        ->orWhere('name', $subdomain);
                })
                ->first();

            if ($dnsRecord) {
                return $dnsRecord;
            }

            if (! $serverIp) {
                break;
            }

            $targetProxied = $proxied ?? true;
            try {
                $recordData = $d->dnsProvider->provider()->createRecord($d->provider_domain_id, [
                    'type' => 'A',
                    'name' => $domainName,
                    'content' => $serverIp,
                    'ttl' => 1,
                    'proxied' => $targetProxied,
                ]);

                return DNSRecord::create([
                    'domain_id' => $d->id,
                    'provider_record_id' => $recordData['id'] ?? '',
                    'type' => 'A',
                    'name' => $domainName,
                    'content' => $serverIp,
                    'ttl' => 1,
                    'proxied' => $targetProxied,
                    'metadata' => $recordData,
                ]);
            } catch (Exception $e) {
                Log::warning("Failed to create DNS record on provider for {$domainName}: " . $e->getMessage());
            }
            break;
        }

        return null;
    }

    private function createViaCloudflareZoneScan(
        string $domainName,
        ?string $serverIp,
        ?bool $proxied,
        int $projectId,
    ): bool {
        $cloudflareProvider = DNSProvider::query()
            ->where('project_id', $projectId)
            ->where('connected', true)
            ->where('provider', 'cloudflare')
            ->first();

        if ($cloudflareProvider && $serverIp) {
            try {
                $zones = $cloudflareProvider->provider()->getDomains();
                foreach ($zones as $zone) {
                    $zoneName = strtolower($zone['name']);
                    $zoneId = (string) $zone['id'];

                    if ($domainName !== $zoneName && ! str_ends_with($domainName, '.' . $zoneName)) {
                        continue;
                    }

                    $targetProxied = $proxied ?? true;
                    $recordData = $cloudflareProvider->provider()->createRecord($zoneId, [
                        'type' => 'A',
                        'name' => $domainName,
                        'content' => $serverIp,
                        'ttl' => 1,
                        'proxied' => $targetProxied,
                    ]);

                    $domainModel = Domain::firstOrCreate(
                        [
                            'dns_provider_id' => $cloudflareProvider->id,
                            'provider_domain_id' => $zoneId,
                            'project_id' => $projectId,
                        ],
                        [
                            'domain' => $zoneName,
                            'user_id' => $cloudflareProvider->user_id,
                        ]
                    );

                    DNSRecord::updateOrCreate(
                        [
                            'domain_id' => $domainModel->id,
                            'provider_record_id' => $recordData['id'] ?? '',
                        ],
                        [
                            'type' => 'A',
                            'name' => $domainName,
                            'content' => $serverIp,
                            'ttl' => 1,
                            'proxied' => $targetProxied,
                            'metadata' => $recordData,
                        ]
                    );

                    return $targetProxied;
                }
            } catch (Exception $e) {
                Log::warning("Cloudflare zone scan failed for {$domainName}: " . $e->getMessage());
            }
        }

        throw ValidationException::withMessages([
            'domain' => ["Could not find matching DNS zone on connected DNS providers for domain '{$domainName}'."],
        ]);
    }
}
