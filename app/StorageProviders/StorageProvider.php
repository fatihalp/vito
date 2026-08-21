<?php

namespace App\StorageProviders;

use App\DTOs\DynamicField;
use App\Models\Server;
use App\SSH\Storage\Storage;

interface StorageProvider
{
    public static function id(): string;

    
    public static function editFields(): array;

    
    public function validationRules(): array;

    
    public function credentialData(array $input): array;

    
    public function editableData(): array;

    
    public function mergeEditData(array $input): array;

    
    public function editValidationRules(array $input): array;

    
    public function connect(array $credentials): bool;

    
    public function forgetCachedState(): void;

    public function ssh(Server $server): Storage;
}
