<?php

namespace App\Actions\Domain;

use App\Actions\Domain\CreateDNSRecord;
use App\Actions\Domain\UpdateDNSRecord;
use App\Models\DNSProvider;
use App\Models\DNSRecord;
use App\Models\Domain;
use App\Models\Site;
use Exception;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class ToggleDomainProxy
{
    /**
     * Toggle Cloudflare proxy (security, DDoS, CDN) for a given site domain.
     *
     * @throws ValidationException
     */
    public function toggle(Site $site, string $domainName, ?bool $proxied = null): bool
    {
        $domainName = strtolower(trim($domainName));
        $serverIp = $site->server->ip;

        // Find existing DNSRecord in local DB
        $dnsRecord = DNSRecord::where('type', 'A')
            ->where(function ($query) use ($domainName) {
                $query->where('name', $domainName)
                    ->orWhere('name', '@');
            })
            ->whereHas('domain.dnsProvider', function ($query) {
                $query->where('connected', true);
            })
            ->first();

        // If not found by exact match, search matching domain suffix
        if (! $dnsRecord) {
            $domains = Domain::whereHas('dnsProvider', function ($query) {
                $query->where('connected', true);
            })->get();

            foreach ($domains as $d) {
                $rootDomain = strtolower($d->domain);
                if ($domainName === $rootDomain || str_ends_with($domainName, '.' . $rootDomain)) {
                    $subdomain = $domainName === $rootDomain ? '@' : str_replace('.' . $rootDomain, '', $domainName);
                    $dnsRecord = DNSRecord::where('domain_id', $d->id)
                        ->where('type', 'A')
                        ->where(function ($q) use ($domainName, $subdomain) {
                            $q->where('name', $domainName)
                                ->orWhere('name', $subdomain);
                        })
                        ->first();

                    if (! $dnsRecord && $serverIp) {
                        // Record does not exist in DB yet, create it on provider
                        $targetProxied = $proxied ?? true;
                        try {
                            $recordData = $d->dnsProvider->provider()->createRecord($d->provider_domain_id, [
                                'type' => 'A',
                                'name' => $domainName,
                                'content' => $serverIp,
                                'ttl' => 1,
                                'proxied' => $targetProxied,
                            ]);

                            DNSRecord::create([
                                'domain_id' => $d->id,
                                'provider_record_id' => $recordData['id'] ?? (string) rand(1000, 999999),
                                'type' => 'A',
                                'name' => $domainName,
                                'content' => $serverIp,
                                'ttl' => 1,
                                'proxied' => $targetProxied,
                                'metadata' => $recordData,
                            ]);

                            return $targetProxied;
                        } catch (Exception $e) {
                            Log::warning("Failed to create DNS record on provider for {$domainName}: " . $e->getMessage());
                        }
                    }
                    break;
                }
            }
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

        // If no DNS record could be found or created, check connected providers
        $user = user();
        $cloudflareProvider = DNSProvider::getByProjectId($user->current_project_id, $user)
            ->where('connected', true)
            ->where('provider', 'cloudflare')
            ->first();

        if ($cloudflareProvider && $serverIp) {
            // Attempt to search zones directly from Cloudflare
            try {
                $zones = $cloudflareProvider->provider()->getDomains();
                foreach ($zones as $zone) {
                    $zoneName = strtolower($zone['name']);
                    $zoneId = (string) $zone['id'];

                    if ($domainName === $zoneName || str_ends_with($domainName, '.' . $zoneName)) {
                        $targetProxied = $proxied ?? true;
                        $recordData = $cloudflareProvider->provider()->createRecord($zoneId, [
                            'type' => 'A',
                            'name' => $domainName,
                            'content' => $serverIp,
                            'ttl' => 1,
                            'proxied' => $targetProxied,
                        ]);

                        // Ensure domain model exists
                        $domainModel = Domain::firstOrCreate(
                            [
                                'dns_provider_id' => $cloudflareProvider->id,
                                'provider_domain_id' => $zoneId,
                            ],
                            [
                                'domain' => $zoneName,
                            ]
                        );

                        DNSRecord::updateOrCreate(
                            [
                                'domain_id' => $domainModel->id,
                                'provider_record_id' => $recordData['id'] ?? (string) rand(1000, 999999),
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
                }
            } catch (Exception $e) {
                Log::warning("Cloudflare zone scan failed for {$domainName}: " . $e->getMessage());
            }
        }

        throw ValidationException::withMessages([
            'domain' => ["Could not find matching DNS zone on connected DNS providers for domain '{$domainName}'. Ensure your Cloudflare provider has access to this zone."],
        ]);
    }
}
