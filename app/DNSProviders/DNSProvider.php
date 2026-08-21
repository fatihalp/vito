<?php

namespace App\DNSProviders;

interface DNSProvider
{
    public static function id(): string;

    
    public function validationRules(array $input): array;

    
    public function credentialData(array $input): array;

    
    public function editableData(): array;

    
    public function mergeEditData(array $input): array;

    
    public function editValidationRules(array $input): array;

    
    public function connect(array $credentials): bool;

    
    public function getDomains(): array;

    
    public function getDomain(string $domainId): array;

    
    public function getRecords(string $domainId): array;

    
    public function createRecord(string $domainId, array $recordData): array;

    
    public function updateRecord(string $domainId, string $recordId, array $recordData): array;

    public function deleteRecord(string $domainId, string $recordId): bool;
}
