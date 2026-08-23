<?php

namespace App\Actions\Site;

use App\Models\DNSRecord;
use App\Models\Site;

class ResolveDomainProxyStatuses
{
    public function resolve(Site $site): array
    {
        $allDomainNames = collect([$site->domain])
            ->merge($site->hostedDomains()->pluck('domain'))
            ->unique()
            ->values();

        $dnsRecords = DNSRecord::where('type', 'A')
            ->whereHas('domain.dnsProvider', function ($query) {
                $query->where('connected', true);
            })
            ->get();

        $domainProxyStatus = [];
        foreach ($allDomainNames as $dName) {
            $matched = $dnsRecords->first(function ($r) use ($dName) {
                $rootDomain = strtolower($r->domain->domain ?? '');
                $sub = $dName === $rootDomain ? '@' : str_replace('.'.$rootDomain, '', $dName);

                return strtolower($r->name) === strtolower($dName) || strtolower($r->name) === strtolower($sub);
            });
            $domainProxyStatus[$dName] = $matched ? (bool) $matched->proxied : false;
        }

        return $domainProxyStatus;
    }
}
