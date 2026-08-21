<?php

namespace App\DNSProviders;

use App\Models\DNSProvider as DNSProviderModel;

abstract class AbstractDNSProvider implements DNSProvider
{
    public function __construct(protected DNSProviderModel $dnsProvider) {}

    
    public function validationRules(array $input): array
    {
        return [
            'token' => 'required',
        ];
    }

    
    public function credentialData(array $input): array
    {
        return [
            'token' => $input['token'] ?? '',
        ];
    }

    
    public function editableData(): array
    {
        return [];
    }

    
    public function mergeEditData(array $input): array
    {
        return [$this->dnsProvider->credentials, false];
    }

    
    public function editValidationRules(array $input): array
    {
        return [];
    }

    
    public function getDomains(): array
    {
        return [];
    }

    
    public function getDomain(string $domainId): array
    {
        return [];
    }

    
    public function getRecords(string $domainId): array
    {
        return [];
    }

    
    public function createRecord(string $domainId, array $recordData): array
    {
        return [];
    }

    
    public function updateRecord(string $domainId, string $recordId, array $recordData): array
    {
        return [];
    }

    public function deleteRecord(string $domainId, string $recordId): bool
    {
        return false;
    }
}
