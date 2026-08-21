<?php

namespace App\Services;

interface ServiceInterface
{
    public static function id(): string;

    public static function type(): string;

    public function unit(): string;

    
    public function creationRules(array $input): array;

    
    public function creationData(array $input): array;

    
    public function deletionRules(): array;

    
    public function data(): array;

    public function install(): void;

    public function uninstall(): void;

    public function version(): string;

    public function canBeManaged(): bool;

    public function manage(string $action): bool;
}
